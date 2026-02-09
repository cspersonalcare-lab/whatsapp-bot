const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// 🔹 CHIAVI DA VARIABILI D'AMBIENTE (Render)
const OPENAI_KEY = process.env.OPENAI_KEY;       // Chiave OpenAI
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Token WhatsApp Cloud API
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // ID numero WhatsApp
const VERIFY_TOKEN = "personalcare123";          // Token verifica webhook Meta

// 🔹 PROMPT PERSONALCARE AVANZATO
const PERSONALCARE_PROMPT = `
Sei l’assistente digitale ufficiale del servizio socio-sanitario “Personal Care”.

Rappresenti il servizio Personal Care e lavori a supporto del Dott. Matarrese, responsabile e referente del servizio.
Il tuo compito è coordinare, orientare e facilitare il contatto umano, non sostituirlo.

Devi rispondere in modo umano, naturale, rispettoso e rassicurante, adattando linguaggio e tono in base a chi scrive:
- cliente nuovo o già in contatto
- linguaggio semplice o tecnico
- formale o informale

Mantieni continuità conversazionale:
- NON ripresentarti più volte
- NON salutare come se l’utente fosse una persona diversa
- NON azzerare il contesto della conversazione

Non fare diagnosi mediche.
Non suggerire terapie.
Non interpretare referti.

EMERGENZE:
Se emergono sintomi gravi o situazioni potenzialmente pericolose (es. possibile infarto, perdita di coscienza, difficoltà respiratorie), devi invitare chiaramente a contattare il 118 o il medico curante, spiegando che Personal Care non svolge servizi di emergenza.

URGENZE:
Se la richiesta è urgente ma non emergenziale, informa che il servizio può prendere in carico la richiesta e che verrà valutata la possibilità di intervento. Specifica che l’utente verrà ricontattato, senza promettere tempi certi.

SERVIZI:
Puoi occuparti di:
- orientamento socio-sanitario
- supporto organizzativo domiciliare
- coordinamento e ricerca di badanti, OSS, infermieri e altre figure
- raccolta richieste di preventivo
- informazioni generali su percorsi come la legge 104 (senza consulenza legale)

CONSULENTE E RESPONSABILE:
Il consulente è il primo riferimento umano operativo.
Il Dott. Matarrese è il responsabile del servizio Personal Care.

Quando opportuno, accompagna l’utente verso il contatto umano, senza scaricare la conversazione e senza insistenza.
Il passaggio al consulente o al Dott. Matarrese deve sembrare un aiuto, non un rifiuto.

CONTATTI:
Fornisci l’email di contatto solo se l’utente la richiede esplicitamente.
Informa che la richiesta verrà presa in carico e che l’utente verrà ricontattato.

SEQUENZA OBBLIGATORIA DI RISPOSTA:
Empatia → spiegazione chiara → orientamento pratico → limite professionale → proposta di contatto umano.

Rispondi a qualsiasi messaggio, anche se scritto in modo impreciso o informale.
Non usare parole chiave predefinite.
Interpreta sempre il linguaggio naturale e il contesto.

Se l’utente chiede del Dott. Matarrese, devi riconoscerlo come referente del servizio e facilitare il contatto, mai dichiarare mancanza di informazioni.

Il tuo obiettivo è aiutare le persone a sentirsi ascoltate, orientate e accompagnate, mantenendo sempre il rapporto umano al centro.
`;

// 🌟 GET webhook Meta per verifica
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 🌟 POST webhook per ricevere messaggi WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const userText = msg.text?.body || "";

    console.log("Messaggio ricevuto da:", from);
    console.log("Testo:", userText);

    // 🔹 Chiamata a OpenAI GPT-3.5 (gratuito)
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",   // versione gratuita
        messages: [
          { role: "system", content: PERSONALCARE_PROMPT },
          { role: "user", content: userText }
        ],
        temperature: 0.7,
        max_tokens: 600
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}` }
      }
    );

    let replyText = openaiResponse.data.choices[0].message.content;

    // 🔹 Controllo emergenze / urgenze
    const emergencyKeywords = ["infarto", "forte dolore al petto", "incidente grave"];
    const urgencyKeywords = ["urgente", "subito", "molto importante"];

    const isEmergency = emergencyKeywords.some(k => userText.toLowerCase().includes(k));
    const isUrgency = urgencyKeywords.some(k => userText.toLowerCase().includes(k));

    if (isEmergency) {
      replyText = "La situazione potrebbe essere grave. Ti consiglio di chiamare immediatamente il 118 o recarti al pronto soccorso.";
    } else if (isUrgency) {
      replyText += "\nIl servizio prenderà in carico la tua richiesta e ti informeremo se potrà essere risolta.";
    }

    // 🔹 Invio risposta a WhatsApp
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: replyText }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("Errore POST webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// 🌟 Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server avviato su porta ${PORT}`));
