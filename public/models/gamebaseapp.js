var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import BaseApp from "./baseapp.js";
/** common logic for game apps and game lobby */
export default class GameBaseApp extends BaseApp {
    /** */
    constructor() {
        super();
        this.apiType = "invalid";
        this.userPresenceStatus = {};
        this.userPresenceStatusRefs = {};
        this.verboseLog = false;
        this.lastMessageId = null;
        // redraw message feed to update time since values
        setInterval(() => this.updateGameMessagesFeed(), this.baseRedrawFeedTimer);
        this.chat_snackbar = document.querySelector("#chat_snackbar");
        document.addEventListener("visibilitychange", () => this.refreshOnlinePresence());
    }
    /** update storage to show online for current user */
    refreshOnlinePresence() {
        if (this.userStatusDatabaseRef) {
            this.userStatusDatabaseRef.set({
                state: "online",
                last_changed: firebase.database.ServerValue.TIMESTAMP,
            });
        }
    }
    /** init rtdb for online persistence status */
    initRTDBPresence() {
        if (!this.uid)
            return;
        if (this.rtdbPresenceInited)
            return;
        this.rtdbPresenceInited = true;
        this.userStatusDatabaseRef = firebase.database().ref("/OnlinePresence/" + this.uid);
        this.isOfflineForDatabase = {
            state: "offline",
            last_changed: firebase.database.ServerValue.TIMESTAMP,
        };
        this.isOnlineForDatabase = {
            state: "online",
            last_changed: firebase.database.ServerValue.TIMESTAMP,
        };
        firebase.database().ref(".info/connected").on("value", (snapshot) => {
            if (snapshot.val() == false)
                return;
            this.userStatusDatabaseRef.onDisconnect().set(this.isOfflineForDatabase).then(() => {
                this.userStatusDatabaseRef.set(this.isOnlineForDatabase);
            });
        });
    }
    /** register a uid to watch for online state
     * @param { string } uid user id
    */
    addUserPresenceWatch(uid) {
        if (!this.userPresenceStatusRefs[uid]) {
            this.userPresenceStatusRefs[uid] = firebase.database().ref("OnlinePresence/" + uid);
            this.userPresenceStatusRefs[uid].on("value", (snapshot) => {
                this.userPresenceStatus[uid] = false;
                const data = snapshot.val();
                if (data && data.state === "online")
                    this.userPresenceStatus[uid] = true;
                this.updateUserPresence();
            });
        }
    }
    /** paint users online status */
    updateUserPresence() {
        document.querySelectorAll(".member_online_status")
            .forEach((div) => {
            if (this.userPresenceStatus[div.dataset.uid])
                div.classList.add("online");
            else
                div.classList.remove("online");
        });
        document.body.classList.remove("seat_user_online0");
        document.body.classList.remove("seat_user_online1");
        document.body.classList.remove("seat_user_online2");
        document.body.classList.remove("seat_user_online3");
        if (this.gameData) {
            if (this.userPresenceStatus[this.gameData["seat0"]])
                document.body.classList.add("seat_user_online0");
            if (this.userPresenceStatus[this.gameData["seat1"]])
                document.body.classList.add("seat_user_online1");
            if (this.userPresenceStatus[this.gameData["seat2"]])
                document.body.classList.add("seat_user_online2");
            if (this.userPresenceStatus[this.gameData["seat3"]])
                document.body.classList.add("seat_user_online3");
        }
    }
    /** init game doc controls and register handlers */
    _initGameCommon() {
        document.querySelector(".player_dock .dock_seat0")
            .addEventListener("click", (e) => this.dockSit(0, e));
        document.querySelector(".player_dock .dock_seat1")
            .addEventListener("click", (e) => this.dockSit(1, e));
        document.querySelector(".player_dock .dock_seat2")
            .addEventListener("click", (e) => this.dockSit(2, e));
        document.querySelector(".player_dock .dock_seat3")
            .addEventListener("click", (e) => this.dockSit(3, e));
        this.seat0_name = document.querySelector(".seat0_name");
        this.seat1_name = document.querySelector(".seat1_name");
        this.seat2_name = document.querySelector(".seat2_name");
        this.seat3_name = document.querySelector(".seat3_name");
        this.seat0_img = document.querySelector(".seat0_img");
        this.seat1_img = document.querySelector(".seat1_img");
        this.seat2_img = document.querySelector(".seat2_img");
        this.seat3_img = document.querySelector(".seat3_img");
        this.seat0_sitdown_btn = document.querySelector(".seat0_sitdown_btn");
        this.seat0_sitdown_btn.addEventListener("click", () => this.gameAPIToggle(0));
        this.seat1_sitdown_btn = document.querySelector(".seat1_sitdown_btn");
        this.seat1_sitdown_btn.addEventListener("click", () => this.gameAPIToggle(1));
        this.seat2_sitdown_btn = document.querySelector(".seat2_sitdown_btn");
        this.seat2_sitdown_btn.addEventListener("click", () => this.gameAPIToggle(2));
        this.seat3_sitdown_btn = document.querySelector(".seat3_sitdown_btn");
        this.seat3_sitdown_btn.addEventListener("click", () => this.gameAPIToggle(3));
        this.gameid_span = document.querySelector(".gameid_span");
        this.turnindex_span = document.querySelector(".turnindex_span");
        this.turnphase_span = document.querySelector(".turnphase_span");
        this.members_list = document.querySelector(".members_list");
        this.visibility_display = document.querySelector(".visibility_display");
        this.seat_count_display = document.querySelector(".seat_count_display");
        this.message_level_display = document.querySelector(".message_level_display");
        this.seats_per_user_display = document.querySelector(".seats_per_user_display");
        this.message_level_select = document.querySelector(".message_level_select");
        this.message_level_select.addEventListener("input", () => this.gameAPIOptions());
        this.seats_per_user_select = document.querySelector(".seats_per_user_select");
        this.seats_per_user_select.addEventListener("input", () => this.gameAPIOptions());
        this.visibility_select = document.querySelector(".visibility_select");
        this.visibility_select.addEventListener("input", () => this.gameAPIOptions());
        this.seat_count_select = document.querySelector(".seat_count_select");
        this.seat_count_select.addEventListener("input", () => this.gameAPIOptions());
        this.mute_button = document.querySelector(".mute_button");
        this.mute_button.addEventListener("click", (e) => this.muteClick(e));
        this.send_message_list_button = document.querySelector(".send_message_list_button");
        this.send_message_list_button.addEventListener("click", () => this.sendGameMessage());
        this.message_list_input = document.querySelector(".message_list_input");
        this.message_list_input.addEventListener("keyup", (e) => {
            if (e.key === "Enter")
                this.sendGameMessage();
        });
        this.messages_list = document.querySelector(".messages_list");
        this.seats_full_display = document.querySelector(".seats_full_display");
        this.match_start = document.querySelector(".match_start");
        this.match_start.addEventListener("click", () => this.startGame());
        this.match_finish = document.querySelector(".match_finish");
        this.match_finish.addEventListener("click", () => this.finishGame());
        this.match_reset = document.querySelector(".match_reset");
        this.match_reset.addEventListener("click", () => this.resetGame());
        this.code_link_href = document.querySelector(".code_link_href");
        this.code_link_copy = document.querySelector(".code_link_copy");
        if (this.code_link_copy)
            this.code_link_copy.addEventListener("click", () => this.copyGameLinkToClipboard());
        this.initGameMessageFeed();
    }
    /** static data for guess and match (name, logo)
     * @return { any } map for lookup game details
    */
    gameTypeMetaData() {
        return {
            guess: {
                name: "Guess?",
                icon: "/images/logo_guess.png",
            },
            match: {
                name: "Match!",
                icon: "/images/logo_match.png",
            },
        };
    }
    /** paint game members list */
    _updateGameMembersList() {
        let html = "";
        if (this.gameData) {
            let members = {};
            if (this.gameData.members)
                members = this.gameData.members;
            let membersList = Object.keys(members);
            membersList = membersList.sort();
            membersList.forEach((member) => {
                this.addUserPresenceWatch(member);
                const data = this._gameMemberData(member);
                const timeSince = this.timeSince(new Date(members[member]));
                html += `<div class="member_list_item">
          <div class="member_online_status" data-uid="${member}"></div>
          <div class="game_user_wrapper">
            <span style="background-image:url(${data.img})"></span>
            <span>${data.name}</span>
          </div>
          <span class="member_list_time_since">${timeSince}</span>
        </div>`;
            });
        }
        this.members_list.innerHTML = html;
    }
    /** resolves sitting down in a seat - needs renamed */
    queryStringPaintProcess() {
        return __awaiter(this, void 0, void 0, function* () {
            const seatId = this.urlParams.get("seat");
            if (seatId !== null && !this.loadSeatingComplete) {
                this.loadSeatingComplete = true;
                if (this.gameData["seat" + seatId] === null) {
                    yield this._gameAPISit(Number(seatId));
                }
                else {
                    if (this.gameData["seat" + seatId] !== this.uid)
                        alert("seat is filled");
                }
            }
        });
    }
    /** call join game api
     * @param { string } gameNumber doc id for game
     */
    gameAPIJoin(gameNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.profile)
                return;
            const body = {
                gameNumber,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + "webPage/games/join", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            if (this.verboseLog) {
                const json = yield fResult.json();
                console.log("join", json);
            }
            return;
        });
    }
    /** stand/sit api call for dock seat
     * @param { number } seatIndex 0 based seat index
     * @return { boolean } api sit/stand result
    */
    gameAPIToggle(seatIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.gameData["seat" + seatIndex.toString()] === this.uid)
                return this._gameAPIStand(seatIndex);
            if (this.gameData["seat" + seatIndex.toString()] !== null &&
                this.gameData.createUser === this.uid)
                return this._gameAPIStand(seatIndex);
            return this._gameAPISit(seatIndex);
        });
    }
    /** sit api call
     * @param { number } seatIndex 0 based seat index
     * @param { gameNumber } gameNumber id for game doc
     * @return { boolean } true is seat sitted in
    */
    _gameAPISit(seatIndex, gameNumber = null) {
        return __awaiter(this, void 0, void 0, function* () {
            if (gameNumber === null)
                gameNumber = this.currentGame;
            const body = {
                gameNumber,
                seatIndex,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + "webPage/games/sit", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            const json = yield fResult.json();
            if (!json.success)
                alert(json.errorMessage);
            return json.success;
        });
    }
    /** stand api call
     * @param { number } seatIndex 0 based seat index
     * @param { gameNumber } gameNumber id for game doc
     * @return { boolean } true seat emptied
    */
    _gameAPIStand(seatIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = {
                gameNumber: this.currentGame,
                seatIndex,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + "webPage/games/stand", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            if (this.verboseLog) {
                const json = yield fResult.json();
                console.log(json);
            }
        });
    }
    /** scrape options from UI and call api */
    gameAPIOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const visibility = this.visibility_select.value;
            const numberOfSeats = Number(this.seat_count_select.value);
            const messageLevel = this.message_level_select.value;
            const seatsPerUser = this.seats_per_user_select.value;
            const body = {
                gameNumber: this.currentGame,
                visibility,
                numberOfSeats,
                seatsPerUser,
                messageLevel,
            };
            if (this.card_deck_select) {
                body.cardDeck = this.card_deck_select.value;
            }
            if (this.scoring_system_select) {
                body.scoringSystem = this.scoring_system_select.value;
            }
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + "webPage/games/options", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            if (this.verboseLog) {
                const json = yield fResult.json();
                console.log("change game options result", json);
            }
        });
    }
    /** member data for a user
     * @param { string } uid user id
     * @return { any } name, img
     */
    _gameMemberData(uid) {
        let name = this.gameData.memberNames[uid];
        let img = this.gameData.memberImages[uid];
        if (!name)
            name = "Anonymous";
        if (!img)
            img = "/images/defaultprofile.png";
        return {
            name,
            img,
        };
    }
    /** setup data listender for user messages */
    initGameMessageFeed() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.gameFeedInited)
                return;
            this.gameFeedInited = true;
            const gameId = this.urlParams.get("game");
            if (!gameId)
                return;
            if (this.gameMessagesSubscription)
                this.gameMessagesSubscription();
            this.gameMessagesSubscription = firebase.firestore().collection(`Games/${gameId}/messages`)
                .orderBy(`created`, "desc")
                .limit(50)
                .onSnapshot((snapshot) => this.updateGameMessagesFeed(snapshot));
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
        snapshot.forEach((doc) => html += this._renderMessageFeedLine(doc));
        this.messages_list.innerHTML = html;
        if (snapshot.docs.length > 0) {
            if (snapshot.docs[0].id !== this.lastMessageId) {
                if (this.lastMessageId !== null)
                    this.showMessageSnackbar();
                this.lastMessageId = snapshot.docs[0].id;
            }
        }
        this.messages_list.querySelectorAll("button.delete_game")
            .forEach((btn) => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.deleteMessage(btn, btn.dataset.gamenumber, btn.dataset.messageid);
        }));
        this.refreshOnlinePresence();
    }
    /** api call for delete user message
     * @param { any } btn dom control
     * @param { string } gameNumber firestore game document id
     * @param { string } messageId firestore message id
     */
    deleteMessage(btn, gameNumber, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            btn.setAttribute("disabled", "true");
            const body = {
                gameNumber,
                messageId,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + "webPage/games/message/delete", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            const result = yield fResult.json();
            if (!result.success)
                alert("Delete message failed");
        });
    }
    /** generate html for message card
     * @param { any } doc firestore message document
     * @param { boolean } messageFeed if true adds delete button and clips message length to 12 (...)
     * @return { string } html for card
     */
    _renderMessageFeedLine(doc, messageFeed = true) {
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
        return `<div class="game_message_list_item${gameOwnerClass}${ownerClass}">
      <div style="display:flex;flex-direction:row">
        <div class="game_user_wrapper member_desc">
          <span style="background-image:url(${img})"></span>
        </div>
        <div class="message" style="flex:1">${message}</div>
        <div class="game_date"><div style="flex:1"></div><div>${timeSince}</div><div style="flex:1"></div></div>
        ${deleteHTML}
      </div>
      ${memberNameHTML}
    </div>`;
    }
    /** api user send message */
    sendGameMessage() {
        return __awaiter(this, void 0, void 0, function* () {
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
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + "webPage/games/message", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            const json = yield fResult.json();
            if (!json.success) {
                console.log("message post", json);
                alert(json.errorMessage);
            }
        });
    }
    /** api call for click in open dock seat to sit
     * @param { number } seatIndex 0 based seat index
     * @return { boolean } true is sit down was success
    */
    dockSit(seatIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.gameData["seat" + seatIndex.toString()] !== null)
                return;
            // if (this.userSeated)
            // return;
            return this._gameAPISit(seatIndex);
        });
    }
    /** show/paint user message snackbar if needed */
    showMessageSnackbar() {
        const doc = this.lastMessagesSnapshot.docs[0];
        // don"t show if msg owner
        if (doc.data().uid === this.uid)
            return;
        this.chat_snackbar.innerHTML = this._renderMessageFeedLine(doc, false);
        this.chat_snackbar.querySelector(".close_button").addEventListener("click", () => {
            this.chat_snackbar.classList.remove("show");
            clearTimeout(this.toggleSnackBarTimeout);
        });
        clearTimeout(this.toggleSnackBarTimeout);
        this.chat_snackbar.classList.add("show");
        this.toggleSnackBarTimeout = setTimeout(() => {
            this.chat_snackbar.classList.remove("show");
        }, 3000);
    }
    /** paint dock seats
     * @param { string } queryPrefix optional query prefix to select a different css dock
     */
    _paintDockSeats(queryPrefix = ".player_dock ") {
        for (let c = 0; c < this.gameData.numberOfSeats; c++) {
            const key = "seat" + c.toString();
            const seat = document.querySelector(queryPrefix + `.dock_seat${c.toString()}`);
            const spans = seat.querySelectorAll("span");
            if (this.gameData[key]) {
                spans[0].style.backgroundImage = "url(" + this._gameMemberData(this.gameData[key]).img + ")";
                seat.classList.remove("dock_seat_open");
            }
            else {
                spans[0].style.backgroundImage = "";
                seat.classList.add("dock_seat_open");
            }
        }
    }
    /** paint dock */
    paintDock() {
        this.seatsFull = 0;
        this.userSeated = false;
        for (let c = 0; c < this.gameData.numberOfSeats; c++) {
            const seatKey = "seat" + c.toString();
            if (this.gameData[seatKey])
                this.seatsFull++;
            if (this.gameData[seatKey] === this.uid)
                this.userSeated = true;
        }
        this._paintDockSeats();
        if (this.userSeated)
            document.body.classList.add("current_user_seated");
        else
            document.body.classList.remove("current_user_seated");
        if (this.uid === this.gameData["seat" + this.gameData.currentSeat])
            document.body.classList.add("current_users_turn");
        else
            document.body.classList.remove("current_users_turn");
        if (this.seatsFull === this.gameData.numberOfSeats) {
            this.seats_full_display.innerHTML = `${this.seatsFull} / ${this.gameData.numberOfSeats} Ready!`;
            this.match_start.removeAttribute("disabled");
        }
        else {
            this.seats_full_display.innerHTML = `${this.seatsFull} / ${this.gameData.numberOfSeats} full`;
            this.match_start.setAttribute("disabled", true);
        }
        document.body.classList.remove("current_seat_0");
        document.body.classList.remove("current_seat_1");
        document.body.classList.remove("current_seat_2");
        document.body.classList.remove("current_seat_3");
        document.body.classList.add("current_seat_" + this.gameData.currentSeat.toString());
    }
    /** paint user editable game options */
    paintOptions() {
        if (this.gameData.createUser === this.uid)
            document.body.classList.add("game_owner");
        else
            document.body.classList.remove("game_owner");
        document.body.classList.remove("mode_ready");
        document.body.classList.remove("mode_running");
        document.body.classList.remove("mode_end");
        let mode = this.gameData.mode;
        if (!mode)
            mode = "ready";
        document.body.classList.add("mode_" + mode);
        this.visibility_display.innerHTML = this.gameData.visibility;
        this.visibility_select.value = this.gameData.visibility;
        this.seat_count_display.innerHTML = this.gameData.numberOfSeats.toString() + " seats";
        this.seat_count_select.value = this.gameData.numberOfSeats;
        this.message_level_display.innerHTML = this.gameData.messageLevel;
        this.message_level_select.value = this.gameData.messageLevel;
        this.seats_per_user_display.innerHTML = this.gameData.seatsPerUser;
        this.seats_per_user_select.value = this.gameData.seatsPerUser;
        if (this.code_link_href) {
            const path = window.location.href;
            this.code_link_href.setAttribute("href", path);
        }
    }
    /** should be named gameOptionsPaintSeats() - paints the seats on the options tab */
    gamePaintSeats() {
        document.body.classList.remove("seatcount_1");
        document.body.classList.remove("seatcount_2");
        document.body.classList.remove("seatcount_3");
        document.body.classList.remove("seatcount_4");
        document.body.classList.remove("runningseatcount_1");
        document.body.classList.remove("runningseatcount_2");
        document.body.classList.remove("runningseatcount_3");
        document.body.classList.remove("runningseatcount_4");
        document.body.classList.add("seatcount_" + this.gameData.numberOfSeats.toString());
        if (!this.gameData.runningNumberOfSeats)
            this.gameData.runningNumberOfSeats = 1;
        let numSeats = this.gameData.runningNumberOfSeats;
        if (this.gameData.mode === "ready")
            numSeats = this.gameData.numberOfSeats;
        document.body.classList.add("runningseatcount_" + numSeats.toString());
        for (let c = 0; c < 4; c++) {
            const key = "seat" + c.toString();
            if (this.gameData[key]) {
                this[key + "_name"].innerHTML = this._gameMemberData(this.gameData[key]).name;
                this[key + "_img"].style.backgroundImage = "url(" + this._gameMemberData(this.gameData[key]).img + ")";
            }
            else {
                this[key + "_name"].innerHTML = "";
                this[key + "_img"].style.backgroundImage = "";
            }
            this[key + "_sitdown_btn"].classList.remove("admin_only");
            if (this.gameData[key] === this.uid) {
                this[key + "_sitdown_btn"].innerHTML = "Stand";
            }
            else {
                if (this.gameData[key]) {
                    this[key + "_sitdown_btn"].innerHTML = "Boot";
                    this[key + "_sitdown_btn"].classList.add("admin_only");
                }
                else {
                    this[key + "_sitdown_btn"].innerHTML = "Sit";
                }
            }
        }
    }
    /** copy game link to global clipboard */
    copyGameLinkToClipboard() {
        const path = this.code_link_href.getAttribute("href");
        navigator.clipboard.writeText(path);
    }
    /** api call to finish game */
    finishGame() {
        return __awaiter(this, void 0, void 0, function* () {
            this.refreshOnlinePresence();
            this.match_finish.setAttribute("disabled", true);
            const action = "endGame";
            const body = {
                gameId: this.currentGame,
                action,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + `webPage/${this.apiType}/action`, {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            const json = yield fResult.json();
            this.match_finish.removeAttribute("disabled");
            if (!json.success) {
                console.log("finish fail", json);
                if (this.alertErrors)
                    alert("Failed to finish game: " + json.errorMessage);
                return;
            }
        });
    }
    /** api call to reset game */
    resetGame() {
        return __awaiter(this, void 0, void 0, function* () {
            this.refreshOnlinePresence();
            this.match_reset.setAttribute("disabled", true);
            const action = "resetGame";
            const body = {
                gameId: this.currentGame,
                action,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + `webPage/${this.apiType}/action`, {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            const json = yield fResult.json();
            this.match_reset.removeAttribute("disabled");
            if (!json.success) {
                console.log("reset fail", json);
                if (this.alertErrors)
                    alert("Failed to reset game: " + json.errorMessage);
                return;
            }
        });
    }
    /** api call to start game */
    startGame() {
        return __awaiter(this, void 0, void 0, function* () {
            this.refreshOnlinePresence();
            this.match_start.setAttribute("disabled", true);
            const action = "startGame";
            const body = {
                gameId: this.currentGame,
                action,
            };
            const token = yield firebase.auth().currentUser.getIdToken();
            const fResult = yield fetch(this.basePath + `webPage/${this.apiType}/action`, {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json",
                    token,
                },
                body: JSON.stringify(body),
            });
            const json = yield fResult.json();
            this.match_start.removeAttribute("disabled");
            if (!json.success) {
                console.log("start fail", json);
                if (this.alertErrors)
                    alert("Failed to start game: " + json.errorMessage);
                return;
            }
            this.matchBoardRendered = false;
        });
    }
}
//# sourceMappingURL=gamebaseapp.js.map