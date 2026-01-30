const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// 🔹 DATI DA INSERIRE
const OPENAI_KEY = process.env.OPENAI_KEY;        // chiave OpenAI
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;       // token Meta WhatsApp Cloud API
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // ID numero WhatsApp
const VERIFY_TOKEN = "personalcare123";                 // token verifica Meta

// 🔹 PROMPT PERSONALCARE AVANZATO (tutto integrato)
const PERSONALCARE_PROMPT = `
Sei l'assistente digitale di orientamento socio-sanitario collegato al servizio Personal Care.
Rispondi in modo umano, chiaro e rassicurante, adattando il tono a chi scrive (conosciuto o meno, linguaggio formale/informale).
Non fare diagnosi, non dare terapie, non interpretare referti.
Gestisci emergenze consigliando di chiamare 118 o medico.
Gestisci urgenze informando che il servizio prenderà in carico la richiesta e che farai sapere se potrà essere risolta.
Organizza preventivi, candidature lavoro, orientamento socio-sanitario, consulenza logistica.
Segui sempre la sequenza: empatia → spiegazione → orientamento → limite professionale → passaggio al consulente.
Rispondi a qualsiasi testo dell'utente, senza usare parole chiave predefinite.
`;

// 🌟 GET per verifica Meta
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

// 🌟 POST per ricevere messaggi
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const userText = msg.text?.body || "";

    console.log("Messaggio ricevuto da:", from);
    console.log("Testo:", userText);

    // 🔹 Chiamata a OpenAI GPT-4 con prompt integrato
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          { role: "system", content: PERSONALCARE_PROMPT },
          { role: "user", content: userText }
        ],
        temperature: 0.7
      },
      { headers: { Authorization: `Bearer ${OPENAI_KEY}` } }
    );

    let replyText = openaiResponse.data.choices[0].message.content;

    // 🔹 Gestione emergenze / urgenze
    const emergencyKeywords = ["infarto", "forte dolore al petto", "incidente grave"];
    const urgencyKeywords = ["urgente", "subito", "molto importante"];

    const isEmergency = emergencyKeywords.some(k => userText.toLowerCase().includes(k));
    const isUrgency = urgencyKeywords.some(k => userText.toLowerCase().includes(k));

    if (isEmergency) {
      replyText = "La situazione potrebbe essere grave. Ti consiglio di chiamare immediatamente il 118 o recarti al pronto soccorso.";
    } else if (isUrgency) {
      replyText += "\nIl servizio prenderà in carico la tua richiesta e ti informeremo se potrà essere risolta.";
    }

    // 🔹 Invio risposta su WhatsApp
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
