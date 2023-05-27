import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import express from "express";
import cors from "cors";
import path from "path";
const gameAPIApp = express();

import GameAPI from "./gameapi";
import MatchAPI from "./matchapi";
import GuessAPI from "./guessapi";
import ChatAI from "./aichatapi";

gameAPIApp.set("views", path.join(__dirname, "views"));
gameAPIApp.set("view engine", "ejs");

firebaseAdmin.initializeApp();


gameAPIApp.use(cors({
    origin: true,
}));

export const lobbyApi = functions.https.onRequest(gameAPIApp);

export const updateDisplayNames = functions.firestore
    .document("Users/{uid}").onWrite(async (change, context) => GameAPI.updateUserMetaData(change, context));

gameAPIApp.post("/games/create", async (req, res) => GameAPI.create(req, res));
gameAPIApp.post("/games/delete", async (req, res) => GameAPI.delete(req, res));
gameAPIApp.post("/games/join", async (req, res) => GameAPI.join(req, res));
gameAPIApp.post("/games/leave", async (req, res) => GameAPI.leave(req, res));
gameAPIApp.post("/games/message", async (req, res) => GameAPI.message(req, res));
gameAPIApp.post("/games/message/delete", async (req, res) => GameAPI.messageDelete(req, res));
gameAPIApp.post("/games/options", async (req, res) => GameAPI.options(req, res));
gameAPIApp.post("/games/sit", async (req, res) => GameAPI.sit(req, res));
gameAPIApp.post("/games/stand", async (req, res) => GameAPI.stand(req, res));

gameAPIApp.post("/guess/action", async (req, res) => GuessAPI.userAction(req, res));
gameAPIApp.post("/match/action", async (req, res) => MatchAPI.userAction(req, res));

gameAPIApp.post("/aichat/message", async (req, res) => ChatAI.submitTicket(req, res));
