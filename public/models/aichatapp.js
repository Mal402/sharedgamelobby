import GameBaseApp from "./gamebaseapp.js";
/** Guess app class */
export class AIChatApp extends GameBaseApp {
    /**  */
    constructor() {
        super();
        this.apiType = "aichat";
        this.tickets_list = document.querySelector(".tickets_list");
        this.game_feed_list_toggle = document.querySelector(".game_feed_list_toggle");
        this.send_message_list_button.addEventListener("click", () => this.postMessageAPI());
        this.message_list_input.addEventListener("keyup", (e) => {
            if (e.key === "Enter")
                this.postMessageAPI();
        });
        this.game_feed_list_toggle.addEventListener("click", (e) => this.toggleOptionsView(e));
        this.toggleOptionsView(null);
        this.initTicketFeed();
    }
    /** setup data listender for user messages */
    async initTicketFeed() {
        if (this.messageFeedRegistered)
            return;
        this.messageFeedRegistered = true;
        const gameId = this.urlParams.get("game");
        if (!gameId)
            return;
        if (this.ticketsSubscription)
            this.ticketsSubscription();
        this.ticketsSubscription = firebase.firestore().collection(`Games/${gameId}/tickets`)
            .orderBy(`created`, "desc")
            .limit(50)
            .onSnapshot((snapshot) => this.updateGameMessagesFeed(snapshot));
        if (this.assistsSubscription)
            this.assistsSubscription();
        this.assistsSubscription = firebase.firestore().collection(`Games/${gameId}/assists`)
            .orderBy(`created`, "desc")
            .limit(50)
            .onSnapshot((snapshot) => this.updateAssistsFeed(snapshot));
    }
    /** paint user message feed
   * @param { any } snapshot firestore query data snapshot
   */
    updateAssistsFeed(snapshot) {
        if (snapshot)
            this.lastAssistsSnapShot = snapshot;
        else if (this.lastAssistsSnapShot)
            snapshot = this.lastAssistsSnapShot;
        else
            return;
        snapshot.forEach((doc) => {
            const assistSection = document.querySelector(`div[ticketid="${doc.id}"] .assist_section`);
            if (assistSection) {
                const data = doc.data();
                console.log(data);
                if (data.success) {
                    if (data.assist.error) {
                        assistSection.innerHTML = data.assist.error.code;
                    }
                    else {
                        assistSection.innerHTML = data.assist.choices["0"].message.content;
                    }
                }
                else
                    assistSection.innerHTML = "API Error";
            }
        });
    }
    /** paint user message feed
   * @param { any } snapshot firestore query data snapshot
   */
    updateGameMessagesFeed(snapshot) {
        if (snapshot)
            this.lastMessagesSnapshot = snapshot;
        else if (this.lastMessagesSnapshot)
            snapshot = this.lastMessagesSnapshot;
        else
            return;
        let html = "";
        snapshot.forEach((doc) => html += this._renderTicketFeedLine(doc));
        this.tickets_list.innerHTML = html;
        this.tickets_list.querySelectorAll("button.delete_game")
            .forEach((btn) => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.deleteMessage(btn, btn.dataset.gamenumber, btn.dataset.messageid);
        }));
        this.refreshOnlinePresence();
        this.updateAssistsFeed(null);
    }
    /** api call for delete user message
     * @param { any } btn dom control
     * @param { string } gameNumber firestore game document id
     * @param { string } messageId firestore message id
     */
    async deleteMessage(btn, gameNumber, messageId) {
        btn.setAttribute("disabled", "true");
        const body = {
            gameNumber,
            messageId,
        };
        const token = await firebase.auth().currentUser.getIdToken();
        const fResult = await fetch(this.basePath + "lobbyApi/games/message/delete", {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "application/json",
                token,
            },
            body: JSON.stringify(body),
        });
        const result = await fResult.json();
        if (!result.success)
            alert("Delete message failed");
    }
    /** generate html for message card
     * @param { any } doc firestore message document
     * @param { boolean } messageFeed if true adds delete button and clips message length to 12 (...)
     * @return { string } html for card
     */
    _renderTicketFeedLine(doc, messageFeed = true) {
        const data = doc.data();
        const gameOwnerClass = data.isGameOwner ? " message_game_owner" : "";
        const ownerClass = data.uid === this.uid ? " message_owner" : "";
        let name = "Anonymous";
        if (data.memberName)
            name = data.memberName;
        let img = "/images/defaultprofile.png";
        if (data.memberImage)
            img = data.memberImage;
        let deleteHTML = "";
        if (messageFeed) {
            deleteHTML = `<button class="delete_game" data-gamenumber="${data.gameNumber}" data-messageid="${doc.id}">
            <i class="material-icons">delete</i>
            </button>`;
        }
        let memberNameHTML = "";
        if (!messageFeed)
            memberNameHTML = `<span class="member_name">${name}</span> <button class="close_button">X</button>`;
        let message = data.message;
        if (!messageFeed) {
            if (message.length > 12)
                message = message.substr(0, 11) + "...";
        }
        const timeSince = this.timeSince(new Date(data.created)).replaceAll(" ago", "");
        return `<div class="game_message_list_item${gameOwnerClass}${ownerClass}" ticketid="${doc.id}">
      <div style="display:flex;flex-direction:row">
        <div class="game_user_wrapper member_desc">
          <span style="background-image:url(${img})"></span>
        </div>
        <div class="message" style="flex:1">${message}</div>
        <div class="game_date"><div style="flex:1"></div><div>${timeSince}</div><div style="flex:1"></div></div>
        ${deleteHTML}
      </div>
      ${memberNameHTML}
      <div class="assist_section">pending...</div>
    </div>`;
    }
    /** api user send message */
    async postMessageAPI() {
        let message = this.message_list_input.value.trim();
        if (message === "") {
            alert("Please supply a message");
            return;
        }
        if (message.length > 1000)
            message = message.substr(0, 1000);
        this.message_list_input.value = "";
        const body = {
            gameNumber: this.currentGame,
            message,
        };
        const token = await firebase.auth().currentUser.getIdToken();
        const fResult = await fetch(this.basePath + "lobbyApi/aichat/message", {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "application/json",
                token,
            },
            body: JSON.stringify(body),
        });
        const json = await fResult.json();
        if (!json.success) {
            console.log("message post", json);
            alert(json.errorMessage);
        }
    }
    /** BaseApp override to paint profile specific authorization parameters */
    authUpdateStatusUI() {
        super.authUpdateStatusUI();
        this.currentGame = null;
        this.gameid_span.innerHTML = "";
        this.initRTDBPresence();
        const gameId = this.urlParams.get("game");
        if (gameId) {
            this.gameAPIJoin(gameId);
            this.currentGame = gameId;
            this.gameid_span.innerHTML = this.currentGame;
            if (this.gameSubscription)
                this.gameSubscription();
            this.gameSubscription = firebase.firestore().doc(`Games/${this.currentGame}`)
                .onSnapshot((doc) => this.paintGameData(doc));
        }
    }
    /** paint game data (game document change handler)
     * @param { any } gameDoc firestore query snapshot
     */
    paintGameData(gameDoc = null) {
        if (gameDoc)
            this.gameData = gameDoc.data();
        if (!this.gameData)
            return;
        this.queryStringPaintProcess();
        this.paintOptions(false);
        this._updateGameMembersList();
        this._updateFinishStatus();
        this.updateUserPresence();
    }
    /** show/hide members list
     * @param { any } e event to prevent default
     */
    toggleOptionsView(e) {
        if (document.body.classList.contains("show_document_feed")) {
            document.body.classList.remove("show_document_feed");
            document.body.classList.add("show_document_options");
            this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">close</i>";
        }
        else {
            document.body.classList.add("show_document_feed");
            document.body.classList.remove("show_document_options");
            this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">menu</i>";
        }
        if (e)
            e.preventDefault();
    }
}
//# sourceMappingURL=aichatapp.js.map