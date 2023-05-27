import * as firebaseAdmin from "firebase-admin";
import BaseClass from "./baseclass";
import fetch from "node-fetch";

/** Match game specific turn logic wrapped in a transaction */
export default class ChatAI {
    /** http endpoint for user posting message to table chat
   * @param { any } req http request object
   * @param { any } res http response object
   */
    static async submitTicket(req: any, res: any) {
        const authResults = await BaseClass.validateCredentials(req.headers.token);
        if (!authResults.success) return BaseClass.respondError(res, authResults.errorMessage);

        const uid = authResults.uid;
        const gameNumber = req.body.gameNumber;
        let message = BaseClass.escapeHTML(req.body.message);
        if (message.length > 1000) message = message.substr(0, 1000);

        const localInstance = BaseClass.newLocalInstance();
        await localInstance.init();

        const gameQuery = await firebaseAdmin.firestore().doc(`Games/${gameNumber}`).get();
        const gameData = gameQuery.data();
        if (!gameData) {
            return BaseClass.respondError(res, "Game not found");
        }

        const userQ = await firebaseAdmin.firestore().doc(`Users/${gameData.createUser}`).get();
        const ownerProfile = userQ.data();
        if (!ownerProfile) {
            return BaseClass.respondError(res, "User not found");
        }

        const isOwner = uid === gameData.createUser;
        const chatGptKey = ownerProfile.chatGptKey;

        const memberImage = gameData.memberImages[uid] ? gameData.memberImages[uid] : "";
        const memberName = gameData.memberNames[uid] ? gameData.memberNames[uid] : "";

        const ticket = {
            uid,
            message,
            created: new Date().toISOString(),
            messageType: "user",
            gameNumber,
            isOwner,
            memberName,
            memberImage,
        };

        const addResult: any = await firebaseAdmin.firestore().collection(`Games/${gameNumber}/tickets`).add(ticket);
        await this._processTicket(ticket, addResult.id, chatGptKey);
        return res.status(200).send({
            success: true,
        });
    }
    /** submit ticket to AI engine
     * @param { any } ticket message details
     * @param { string } id document id
     * @param { string } chatGptKey api key from user profile
     * @return { Promise<void> }
     */
    static async _processTicket(ticket: any, id: string, chatGptKey: string) {
        try {
            const body = {
                "model": "gpt-3.5-turbo",
                "messages": [{
                    "role": "user",
                    "content": ticket.message,
                }],
            };

            const response: any = await fetch(`https://api.openai.com/v1/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + chatGptKey,
                },
                body: JSON.stringify(body),
            });

            const assist: any = await response.json();
            await firebaseAdmin.firestore().doc(`Games/${ticket.gameNumber}/assists/${id}`).set({
                success: true,
                created: new Date().toISOString(),
                assist,
            });
        } catch (aiRequestError: any) {
            await firebaseAdmin.firestore().doc(`Games/${ticket.gameNumber}/assists/${id}`).set({
                success: false,
                created: new Date().toISOString(),
                error: aiRequestError,
            });
        }
    }
}
