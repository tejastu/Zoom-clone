const express = require("express");
const app = express();
// const cors = require('cors')
// app.use(cors())
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { ExpressPeerServer } = require("peer");
const peerServer = ExpressPeerServer(server, {
   debug: true,
});
const { v4: uuidV4 } = require("uuid");

app.use("/peerjs", peerServer);

const LanguageTranslatorV3 = require("ibm-watson/language-translator/v3");
const { IamAuthenticator } = require("ibm-watson/auth");

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
   res.redirect(`/${uuidV4()}`);
});

app.get("/:room", (req, res) => {
   res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
   socket.on("join-room", (roomId, userId) => {
      socket.join(roomId);
      socket.to(roomId).broadcast.emit("user-connected", userId);
      // messages
      socket.on("message", (message) => {
         //send message to the same room
         io.to(roomId).emit("createMessage", message);
      });

      socket.on("disconnect", () => {
         socket.to(roomId).broadcast.emit("user-disconnected", userId);
      });
   });
});

let translatedText = "Not have anything to translate";

const languageTranslator = new LanguageTranslatorV3({
   //  Please fill the blanks with your credentials
   version: "2018-05-01",

   authenticator: new IamAuthenticator({
      apikey: "jzupzR4mMVorAoDXA01qj1aBUsMatZoIXkPLSo24ctFN",
   }),
   serviceUrl:
      "https://api.eu-gb.language-translator.watson.cloud.ibm.com/instances/425d1451-2a20-4488-9e48-326dd2959bf7",

   //  disableSslVerification: true,
});

let users = {};

let model_lang = {
   English: "en-hi",
   हिन्दी: "hi-en",
};

io.on("connection", (socket) => {
   socket.on("new", (name) => {
      users[socket.id] = name;
      console.log("new-user is", name, "\n");

      socket.broadcast.emit("lets-start", name);
   });

   // Data received from the each client
   socket.on(`send-to-server`, (data) => {
      //Data in same language from client is printed on colsole
      console.log(
         "Data of user is ->",
         data.FT,
         "and laguage of client is ",
         data.language,
         "\n"
      );

      // Passing the data to language translator model to get translated text
      const translateParams = {
         text: data.FT,
         modelId: model_lang[data.language],
      };

      console.log(
         "Data of user ",
         users[socket.id],
         " is ",
         data.FT,
         "and laguage of client is ",
         data.language,
         "\n"
      );

      languageTranslator
         .translate(translateParams)
         .then((translationResult) => {
            // Translated text will be shown on server and
            translatedText =
               translationResult["result"]["translations"][0]["translation"];
            console.log(translatedText);
            // [{"translation":"आप कैसे हैं"}]
            // Then broadcasted to other users
            socket.broadcast.emit(`client-receive`, {
               F: translatedText,
               user: users[socket.id],
            });
         })
         .catch((err) => {
            console.log("error:", err);
         });
   });
});


const PORT = process.env.PORT || 3000;

console.log(`video call server started at 3000`);
server.listen(PORT, () => console.log(`Server Started on ${PORT}`));
