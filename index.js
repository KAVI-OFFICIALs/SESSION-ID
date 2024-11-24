import express from "express";
import bodyParser from "body-parser";
import { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState } from "@whiskeysockets/baileys";
import fs from "fs";
import chalk from "chalk";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let currentSocket;

// HTML Form to accept phone number
app.get("/", (req, res) => {
  res.send(`
    <h1>WhatsApp Pairing</h1>
    <form method="POST" action="/pair">
      <label for="phone">Enter WhatsApp Phone Number:</label>
      <input type="text" id="phone" name="phone" required placeholder="+94771227821" />
      <button type="submit">Generate Pairing Code</button>
    </form>
  `);
});

// Generate Pairing Code
app.post("/pair", async (req, res) => {
  const phoneNumber = req.body.phone?.replace(/[^0-9]/g, "");

  if (!phoneNumber || !phoneNumber.startsWith("94")) {
    return res.send("Invalid Phone Number! Please use country code (e.g., +94771227821).");
  }

  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./session-${phoneNumber}`);

    const socket = makeWASocket({
      version,
      auth: state,
      logger: { level: "silent" },
    });

    currentSocket = socket;

    socket.ev.on("connection.update", async (update) => {
      const { connection } = update;
      if (connection === "open") {
        console.log(chalk.green("✅ WhatsApp connected!"));
      }
    });

    socket.ev.on("creds.update", saveCreds);

    // Generate Pairing Code
    const code = await socket.requestPairingCode(phoneNumber);
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

    res.send(`
      <h1>Pairing Code Generated</h1>
      <p>Phone Number: ${phoneNumber}</p>
      <p>Pairing Code: <strong>${formattedCode}</strong></p>
      <a href="/">Go Back</a>
    `);
  } catch (error) {
    console.error(chalk.red("❌ Error generating pairing code:"), error);
    res.send("An error occurred while generating the pairing code. Please try again.");
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
