import GameBaseApp from "./gamebaseapp.js";
/** Match game UI app */
export class MatchApp extends GameBaseApp {
    /** */
    constructor() {
        super();
        this.currentplayer_score_dock = document.querySelector(".currentplayer_score_dock");
        this.match_board_wrapper = document.querySelector(".match_board_wrapper");
        this.card_deck_display = document.querySelector(".card_deck_display");
        this.card_deck_select = document.querySelector(".card_deck_select");
        this.scoring_system_display = document.querySelector(".scoring_system_display");
        this.scoring_system_select = document.querySelector(".scoring_system_select");
        this.turn_number_div = document.querySelector(".turn_number_div");
        this.player_total_points = document.querySelector(".player_total_points");
        this.player_total_for_turn = document.querySelector(".player_total_for_turn");
        this.player_dock_prompt = document.querySelector(".player_dock_prompt");
        this.game_feed_list_toggle = document.querySelector(".game_feed_list_toggle");
        this.tracer_line_0 = document.querySelector(".tracer_line_0");
        this.tracer_line_1 = document.querySelector(".tracer_line_1");
        this.members_header_toggle_button = document.querySelector(".members_header_toggle_button");
        this.cardDeckCached = "none";
        this.cardDeckCacheDom = document.querySelector(".card_deck_cache");
        this.matchCards = [];
        this.zoom_out_beer_cards = [];
        this.cardsPerColumn = 0;
        this.alertErrors = false;
        this.currentGame = null;
        this.apiType = "match";
        this._initGameCommon();
        this.card_deck_select.addEventListener("input", () => this.gameAPIOptions());
        this.scoring_system_select.addEventListener("input", () => this.gameAPIOptions());
        this.player_dock_prompt.addEventListener("click", () => this.turnPhaseAdvance());
        this.game_feed_list_toggle.addEventListener("click", (e) => this.toggleOptionsView(e));
        this.members_header_toggle_button.addEventListener("click", (e) => this.toggleMembersHeader(e));
        this.toggleOptionsView(null);
    }
    /** show/hide members list in header
     * @param { any } e dom event to prevent default
     */
    toggleMembersHeader(e) {
        document.body.classList.toggle("members_expanded");
        e.preventDefault();
    }
    /** show/hide options view in UI
     * @param { any } e event
      */
    toggleOptionsView(e) {
        if (document.body.classList.contains("show_game_table")) {
            document.body.classList.remove("show_game_table");
            document.body.classList.add("show_game_options");
            this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">close</i>";
        }
        else {
            document.body.classList.add("show_game_table");
            document.body.classList.remove("show_game_options");
            this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">settings</i>";
        }
        if (e)
            e.preventDefault();
    }
    /** BaseApp override to paint profile specific authorization parameters */
    async authUpdateStatusUI() {
        super.authUpdateStatusUI();
        this.gameid_span.innerHTML = "";
        this.initRTDBPresence();
        const gameId = this.urlParams.get("game");
        if (gameId) {
            await this.gameAPIJoin(gameId);
            this.currentGame = gameId;
            this.gameid_span.innerHTML = this.currentGame;
            if (this.gameSubscription)
                this.gameSubscription();
            this.gameSubscription = firebase.firestore().doc(`Games/${this.currentGame}`)
                .onSnapshot((doc) => this.paintGameData(doc));
        }
    }
    /** BaseApp override to load card decks */
    async load() {
        await this.readJSONFile(`/match/ziplinedeck.json`, "ziplineCardDeck");
        await this.readJSONFile(`/match/empyreandeck.json`, "empyreanCardDeck");
        await super.load();
    }
    /** gets array of cards for a deck - unshuffled
     * @return { Array<any> } array of cards for active deck
     */
    getCardDeck() {
        if (this.gameData.cardDeck === "zipline")
            return window.ziplineCardDeck;
        return window.empyreanCardDeck;
    }
    /** cache card deck images in dom for fast UI load */
    _cacheCardDeckImages() {
        if (this.cardDeckCached === this.gameData.cardDeck)
            return;
        this.cardDeckCacheDom.innerHTML = "";
        this.getCardDeck().forEach((card) => {
            const img = document.createElement("img");
            img.src = this.allBeers[card.beerSlug].mapImage;
            this.cardDeckCacheDom.appendChild(img);
        });
    }
    /** gets card meta and totals for a card (based on shuffled deck order)
     * @param { number } cardIndex 0 based index of a card for the deck
     * @return { any } meta data for a specific card
     */
    getCardMeta(cardIndex) {
        let cards = 8;
        if (this.gameData.runningNumberOfSeats > 2)
            cards = 12;
        cardIndex = cardIndex % cards;
        let cardData = this.getCardDeck()[cardIndex];
        if (!cardData)
            cardData = {};
        const beerSlug = cardData.beerSlug;
        const cardInfo = {
            beerSlug,
            deckIndex: cardIndex,
            fullName: this.gameNameForBeer(beerSlug),
        };
        if (beerSlug) {
            cardInfo.beerTotals = window.beerTotals.beers[beerSlug];
            cardInfo.beerData = this.allBeers[beerSlug];
            if (cardInfo.beerData) {
                cardInfo.img = cardInfo.beerData.mapImage;
            }
        }
        return cardInfo;
    }
    /** override to add turn phase sounds */
    paintSounds() {
        super.paintSounds();
        if (!this.gameData)
            return;
        if (!this.muted) {
            if (this.currentUserTurn) {
                if (this.soundGameStateCache.turnNumber !== this.gameData.turnNumber &&
                    this.gameData.mode === "running" &&
                    this.gameData.turnNumber !== 0) {
                    console.log(this.gameData, this.soundGameStateCache);
                    const audio = this.audios.get("turnstart");
                    audio.currentTime = 0;
                    this.playAudio(audio);
                    setTimeout(() => audio.pause(), 1000);
                }
            }
        }
        this.soundGameStateCache.currentUserTurn = this.currentUserTurn;
        this.soundGameStateCache.turnNumber = this.gameData.turnNumber;
        this.soundGameStateCache.turnPhase = this.gameData.turnPhase;
    }
    /** paint game data
     * @param { any } gameDoc firestore game query result document
    */
    paintGameData(gameDoc = null) {
        if (gameDoc)
            this.gameData = gameDoc.data();
        if (!this.gameData)
            return;
        if (!this.allBeers)
            return;
        if (!window.beerTotals)
            return;
        document.body.classList.add("game_loaded");
        this._cacheCardDeckImages();
        this.queryStringPaintProcess();
        this.paintOptions();
        this.card_deck_display.innerHTML = this.gameData.cardDeck;
        this.card_deck_select.value = this.gameData.cardDeck;
        this.scoring_system_display.innerHTML = this.gameData.scoringSystem;
        this.scoring_system_select.value = this.gameData.scoringSystem;
        this._updateGameMembersList();
        this.gamePaintSeats();
        this.paintDock();
        this._paintDockSeats(".match_end_result ");
        this.paintSounds();
        if (this.gameData.mode === this.previousMode)
            this.matchBoardRendered = false;
        this.previousMode = this.gameData.mode;
        if (this.matchBoardRendered !== this.gameData.cardCount)
            this._renderMatchBoard();
        document.body.classList.remove("turnphase_select");
        document.body.classList.remove("turnphase_result");
        document.body.classList.remove("turnphase_clearprevious");
        let phase = "select";
        if (this.gameData.turnPhase)
            phase = this.gameData.turnPhase;
        document.body.classList.add("turnphase_" + phase);
        let phaseDesc = "Select";
        let disabled = true;
        if (this.gameData.turnPhase === "clearprevious") {
            phaseDesc = "Clear";
            disabled = false;
        }
        else if (this.gameData.turnPhase === "result") {
            phaseDesc = "Next";
            disabled = false;
        }
        if (disabled)
            this.player_dock_prompt.setAttribute("disabled", true);
        else
            this.player_dock_prompt.removeAttribute("disabled");
        let seatIndex = "0";
        if (this.gameData.currentSeat)
            seatIndex = this.gameData.currentSeat.toString();
        const displayTurnNumber = Math.floor(this.gameData.turnNumber / this.gameData.runningNumberOfSeats) + 1;
        this.turn_number_div.innerHTML = displayTurnNumber.toString();
        const pts = this.gameData["seatPoints" + seatIndex];
        this.player_total_points.innerHTML = pts;
        this.player_total_for_turn.innerHTML = this.gameData.pairsInARowMatched;
        this.player_dock_prompt.innerHTML = phaseDesc;
        this.currentplayer_score_dock.classList.remove("seat_color_0");
        this.currentplayer_score_dock.classList.remove("seat_color_1");
        this.currentplayer_score_dock.classList.remove("seat_color_2");
        this.currentplayer_score_dock.classList.remove("seat_color_3");
        this.match_board_wrapper.classList.remove("seat_color_0");
        this.match_board_wrapper.classList.remove("seat_color_1");
        this.match_board_wrapper.classList.remove("seat_color_2");
        this.match_board_wrapper.classList.remove("seat_color_3");
        this.currentplayer_score_dock.classList.add("seat_color_" + seatIndex);
        this.match_board_wrapper.classList.add("seat_color_" + seatIndex);
        this._updateCardStatus();
        this._updateFinishStatus();
        this.updateUserPresence();
    }
    /** paint cards display */
    _updateCardStatus() {
        for (let c = 0, l = this.gameData.cardCount; c < l; c++) {
            this.matchCards[c].classList.remove("previously_shown");
            this.matchCards[c].classList.remove("matched_hidden");
            this.matchCards[c].classList.remove("show_face");
            this.matchCards[c].style.backgroundImage = "";
            this.matchCards[c].classList.remove("selection_missed");
            this.matchCards[c].classList.remove("selection_matched");
            if (this.gameData.cardIndexesShown[c])
                this.matchCards[c].classList.add("previously_shown");
            if (this.gameData.cardIndexesRemoved[c] && c !== this.gameData.previousCard0 &&
                c !== this.gameData.previousCard1)
                this.matchCards[c].classList.add("matched_hidden");
        }
        if (this.gameData.previousCard0 > -1) {
            const card = this.matchCards[this.gameData.previousCard0];
            card.classList.add("show_face");
            const span = card.querySelector("span");
            span.style.backgroundImage = "url(" + atob(span.dataset.bkg) + ")";
        }
        if (this.gameData.previousCard1 > -1) {
            const card = this.matchCards[this.gameData.previousCard1];
            card.classList.add("show_face");
            const span = card.querySelector("span");
            span.style.backgroundImage = "url(" + atob(span.dataset.bkg) + ")";
        }
        if (!this.zoom_out_beer_cards)
            return;
        this.zoom_out_beer_cards.forEach((ctl) => ctl.classList.remove("selection_missed"));
        this.zoom_out_beer_cards.forEach((ctl) => ctl.classList.remove("selection_matched"));
        this._updateCardZoomState();
        if (this.gameData.previousCard0 > -1 && this.gameData.previousCard1 > -1) {
            if (this.gameData.selectionMatched) {
                this.matchCards[this.gameData.previousCard0].classList.add("selection_matched");
                this.matchCards[this.gameData.previousCard1].classList.add("selection_matched");
                this.zoom_out_beer_cards.forEach((ctl) => ctl.classList.add("selection_matched"));
            }
            else {
                this.matchCards[this.gameData.previousCard0].classList.add("selection_missed");
                this.matchCards[this.gameData.previousCard1].classList.add("selection_missed");
                this.zoom_out_beer_cards.forEach((ctl) => ctl.classList.add("selection_missed"));
            }
            const smallCard0 = this.matchCards[this.gameData.previousCard0];
            const smallCard1 = this.matchCards[this.gameData.previousCard1];
            const leftOffset = this.match_board_wrapper.getBoundingClientRect().x;
            const topOffset = this.match_board_wrapper.getBoundingClientRect().y;
            const setTracer = (smallCard, bigCard, line) => {
                const smallWidth = smallCard.getBoundingClientRect().width;
                const smallHeight = smallCard.getBoundingClientRect().height;
                const bigWidth = bigCard.getBoundingClientRect().width;
                const bigHeight = bigCard.getBoundingClientRect().height;
                const smallX0 = smallCard.getBoundingClientRect().x + smallWidth / 2;
                const smallY0 = smallCard.getBoundingClientRect().y + smallHeight / 2;
                const bigX0 = bigCard.getBoundingClientRect().x + bigWidth / 2;
                const bigY0 = bigCard.getBoundingClientRect().y + bigHeight / 2;
                const startPoint = [smallX0, smallY0];
                const endPoint = [bigX0, bigY0];
                const rise = endPoint[1] - startPoint[1];
                const run = endPoint[0] - startPoint[0];
                const slope = rise / run;
                const DEGREES = 57.2957795;
                const width = Math.sqrt((rise * rise) + (run * run));
                line.style.top = startPoint[0] + "px";
                line.style.left = startPoint[1] + "px";
                line.style.width = width + "px";
                line.style.transform = "rotate(" + (Math.atan(slope) * DEGREES) + "deg)";
                line.style.transformOrigin = "0 0";
                let deltaX0 = smallX0;
                let deltaY0 = smallY0;
                if (smallX0 > bigX0 && smallY0 < bigY0) {
                    deltaY0 = bigY0;
                    deltaX0 = bigX0;
                }
                else if (smallX0 > bigX0 && smallY0 > bigY0) {
                    deltaX0 = bigX0;
                    deltaY0 = bigY0;
                }
                line.style.left = deltaX0 - leftOffset + "px";
                line.style.top = deltaY0 - topOffset + "px";
            };
            setTracer(smallCard0, this.bigDiv0, this.tracer_line_0);
            this.tracer_line_0.style.display = "block";
            setTracer(smallCard1, this.bigDiv1, this.tracer_line_1);
            this.tracer_line_1.style.display = "block";
        }
        else {
            this.tracer_line_0.style.display = "none";
            this.tracer_line_1.style.display = "none";
        }
    }
    /** paint cards on table */
    _renderMatchBoard() {
        this.matchBoardRendered = this.gameData.cardCount;
        const lowerLeft = document.querySelector(".lower_left.match_quandrant");
        const lowerRight = document.querySelector(".lower_right.match_quandrant");
        const upperLeft = document.querySelector(".upper_left.match_quandrant");
        const upperRight = document.querySelector(".upper_right.match_quandrant");
        lowerLeft.innerHTML = "";
        lowerRight.innerHTML = "";
        upperLeft.innerHTML = "";
        upperRight.innerHTML = "";
        this.matchCards = [];
        this.cardsPerColumn = 2;
        if (this.gameData.runningNumberOfSeats > 2)
            this.cardsPerColumn = 3;
        for (let cardIndex = 0; cardIndex < this.cardsPerColumn * 8; cardIndex++) {
            const div = document.createElement("div");
            div.classList.add("match_card_wrapper");
            div.addEventListener("click", (e) => this.cardSelected(e, div, cardIndex));
            const orderIndex = this.gameData.cardIndexOrder[cardIndex];
            const meta = this.getCardMeta(orderIndex);
            const cardInfo = {
                boardPositionIndex: cardIndex,
                orderIndex,
                meta,
                image: meta.img,
            };
            div.innerHTML = this._cardTemplate(cardInfo);
            if (cardIndex < this.cardsPerColumn * 2)
                upperLeft.appendChild(div);
            else if (cardIndex < this.cardsPerColumn * 4)
                upperRight.appendChild(div);
            else if (cardIndex < this.cardsPerColumn * 6)
                lowerLeft.appendChild(div);
            else
                lowerRight.appendChild(div);
            this.matchCards.push(div);
        }
        this.upperLeftDisplayCard = document.createElement("div");
        this.upperLeftDisplayCard.classList.add("zoom_out_beer_card");
        upperLeft.appendChild(this.upperLeftDisplayCard);
        this.upperRightDisplayCard = document.createElement("div");
        this.upperRightDisplayCard.classList.add("zoom_out_beer_card");
        upperRight.appendChild(this.upperRightDisplayCard);
        this.lowerLeftDisplayCard = document.createElement("div");
        this.lowerLeftDisplayCard.classList.add("zoom_out_beer_card");
        lowerLeft.appendChild(this.lowerLeftDisplayCard);
        this.lowerRightDisplayCard = document.createElement("div");
        this.lowerRightDisplayCard.classList.add("zoom_out_beer_card");
        lowerRight.appendChild(this.lowerRightDisplayCard);
        this.upperLeftDisplayCard.addEventListener("click", () => this.turnPhaseAdvance());
        this.upperRightDisplayCard.addEventListener("click", () => this.turnPhaseAdvance());
        this.lowerLeftDisplayCard.addEventListener("click", () => this.turnPhaseAdvance());
        this.lowerRightDisplayCard.addEventListener("click", () => this.turnPhaseAdvance());
        this.zoom_out_beer_cards = document.querySelectorAll(".zoom_out_beer_card");
    }
    /** advances a player turn to next phase */
    turnPhaseAdvance() {
        if (this.uid !== this.gameData["seat" + this.gameData.currentSeat])
            return;
        if (this.gameData.turnPhase === "result") {
            this._endTurn();
            return;
        }
        this._clearSelection();
        this._updateCardStatus();
    }
    /** handle a user selecting a card
     * @param { any } e dom event
     * @param { any } div dom element
     * @param { number } cardIndex 0 based card index
     */
    cardSelected(e, div, cardIndex) {
        this.refreshOnlinePresence();
        if (this.uid !== this.gameData["seat" + this.gameData.currentSeat])
            return;
        if (this.gameData.turnPhase !== "select") {
            this.turnPhaseAdvance();
            return;
        }
        if (div.classList.contains("show_face"))
            return;
        div.classList.add("user_click_to_show_face");
        if (this.gameData.previousCard0 < 0) {
            this.gameData.previousCard0 = cardIndex;
            this._sendUpdateSelection();
        }
        else if (this.gameData.previousCard1 < 0) {
            this.gameData.previousCard1 = cardIndex;
            this._sendSelection();
        }
    }
    /** paint flipped up cards */
    _updateCardZoomState() {
        if (!this.upperLeftDisplayCard)
            return;
        this.upperLeftDisplayCard.style.display = "";
        this.upperRightDisplayCard.style.display = "";
        this.lowerLeftDisplayCard.style.display = "";
        this.lowerRightDisplayCard.style.display = "";
        if (this.gameData.previousCard0 >= 0 &&
            this.gameData.previousCard1 >= 0) {
            const card0 = this.gameData.previousCard0;
            const card1 = this.gameData.previousCard1;
            const q0 = this._quandrantForCard(card0);
            const q1 = this._quandrantForCard(card1);
            let qs0 = 1;
            if (q0 === 0) {
                if (q1 !== 1)
                    qs0 = 1;
                else
                    qs0 = 2;
            }
            if (q0 === 1) {
                if (q1 !== 3)
                    qs0 = 3;
                else
                    qs0 = 0;
            }
            if (q0 === 2) {
                if (q1 !== 3)
                    qs0 = 3;
                else
                    qs0 = 0;
            }
            if (q0 === 3) {
                if (q1 !== 2)
                    qs0 = 2;
                else
                    qs0 = 1;
            }
            let qs1 = 1;
            if (q1 === 0) {
                if (q0 !== 1 && qs0 !== 1)
                    qs1 = 1;
                else
                    qs1 = 2;
            }
            if (q1 === 1) {
                if (q0 !== 3 && qs0 !== 3)
                    qs1 = 3;
                else
                    qs1 = 0;
            }
            if (q1 === 2) {
                if (q0 !== 3 && qs0 !== 3)
                    qs1 = 3;
                else
                    qs1 = 0;
            }
            if (q1 === 3) {
                if (q0 !== 2 && qs0 !== 2)
                    qs1 = 2;
                else
                    qs1 = 1;
            }
            const card0Meta = this.getCardMeta(this.gameData.cardIndexOrder[card0]);
            if (qs0 === 0) {
                this.bigDiv0 = this.upperLeftDisplayCard;
                this.upperLeftDisplayCard.style.display = "block";
                this.upperLeftDisplayCard.style.backgroundImage = `url(${card0Meta.img})`;
                if (q0 === 1) {
                    this.upperLeftDisplayCard.style.top = "10%";
                    this.upperLeftDisplayCard.style.right = "-5%";
                }
                else {
                    this.upperLeftDisplayCard.style.bottom = "-5%";
                    this.upperLeftDisplayCard.style.left = "10%";
                }
            }
            if (qs0 === 1) {
                this.bigDiv0 = this.upperRightDisplayCard;
                this.upperRightDisplayCard.style.display = "block";
                this.upperRightDisplayCard.style.backgroundImage = `url(${card0Meta.img})`;
                if (q0 === 0) {
                    this.upperRightDisplayCard.style.top = "10%";
                    this.upperRightDisplayCard.style.left = "-5%";
                }
                else {
                    this.upperRightDisplayCard.style.bottom = "-5%";
                    this.upperRightDisplayCard.style.left = "10%";
                }
            }
            if (qs0 === 2) {
                this.bigDiv0 = this.lowerLeftDisplayCard;
                this.lowerLeftDisplayCard.style.display = "block";
                this.lowerLeftDisplayCard.style.backgroundImage = `url(${card0Meta.img})`;
                if (q0 === 0) {
                    this.lowerLeftDisplayCard.style.top = "-5%";
                    this.lowerLeftDisplayCard.style.left = "10%";
                }
                else {
                    this.lowerLeftDisplayCard.style.top = "10%";
                    this.lowerLeftDisplayCard.style.right = "-5%";
                }
            }
            if (qs0 === 3) {
                this.bigDiv0 = this.lowerRightDisplayCard;
                this.lowerRightDisplayCard.style.display = "block";
                this.lowerRightDisplayCard.style.backgroundImage = `url(${card0Meta.img})`;
                if (q0 === 1) {
                    this.lowerRightDisplayCard.style.top = "-5%";
                    this.lowerRightDisplayCard.style.left = "10%";
                }
                else {
                    this.lowerRightDisplayCard.style.top = "10%";
                    this.lowerRightDisplayCard.style.left = "-5%";
                }
            }
            const card1Meta = this.getCardMeta(this.gameData.cardIndexOrder[card1]);
            if (qs1 === 0) {
                this.bigDiv1 = this.upperLeftDisplayCard;
                this.upperLeftDisplayCard.style.display = "block";
                this.upperLeftDisplayCard.style.backgroundImage = `url(${card1Meta.img})`;
                if (q1 === 1) {
                    this.upperLeftDisplayCard.style.top = "10%";
                    this.upperLeftDisplayCard.style.right = "-5%";
                }
                else {
                    this.upperLeftDisplayCard.style.bottom = "-5%";
                    this.upperLeftDisplayCard.style.left = "10%";
                }
            }
            if (qs1 === 1) {
                this.bigDiv1 = this.upperRightDisplayCard;
                this.upperRightDisplayCard.style.display = "block";
                this.upperRightDisplayCard.style.backgroundImage = `url(${card1Meta.img})`;
                if (q1 === 0) {
                    this.upperRightDisplayCard.style.top = "10%";
                    this.upperRightDisplayCard.style.left = "-5%";
                }
                else {
                    this.upperRightDisplayCard.style.bottom = "-5%";
                    this.upperRightDisplayCard.style.left = "10%";
                }
            }
            if (qs1 === 2) {
                this.bigDiv1 = this.lowerLeftDisplayCard;
                this.lowerLeftDisplayCard.style.display = "block";
                this.lowerLeftDisplayCard.style.backgroundImage = `url(${card1Meta.img})`;
                if (q1 === 0) {
                    this.lowerLeftDisplayCard.style.top = "-5%";
                    this.lowerLeftDisplayCard.style.left = "10%";
                }
                else {
                    this.lowerLeftDisplayCard.style.top = "10%";
                    this.lowerLeftDisplayCard.style.right = "-5%";
                }
            }
            if (qs1 === 3) {
                this.bigDiv1 = this.lowerRightDisplayCard;
                this.lowerRightDisplayCard.style.display = "block";
                this.lowerRightDisplayCard.style.backgroundImage = `url(${card1Meta.img})`;
                if (q1 === 1) {
                    this.lowerRightDisplayCard.style.top = "-5%";
                    this.lowerRightDisplayCard.style.left = "10%";
                }
                else {
                    this.lowerRightDisplayCard.style.top = "10%";
                    this.lowerRightDisplayCard.style.left = "-5%";
                }
            }
            this.cardShowQs = {
                q0,
                q1,
                qs0,
                qs1,
            };
        }
    }
    /** return quandrant for card index (0 - 3)
     * @param { number } card card position index
     * @return { number } quandrant index; 0 - 3
     */
    _quandrantForCard(card) {
        return Math.floor(card / (this.cardsPerColumn * 2));
    }
    /** api call to send card selection */
    async _sendSelection() {
        //  this.match_start.setAttribute("disabled", true);
        const action = "sendSelection";
        const selectedCards = [];
        const body = {
            gameId: this.currentGame,
            previousCard0: this.gameData.previousCard0,
            previousCard1: this.gameData.previousCard1,
            action,
            selectedCards,
        };
        const token = await firebase.auth().currentUser.getIdToken();
        const fResult = await fetch(this.basePath + `lobbyApi/${this.apiType}/action`, {
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
        this.match_start.removeAttribute("disabled");
        if (!json.success) {
            console.log("selection send fail", json);
            if (this.alertErrors)
                alert("Failed to send selection: " + json.errorMessage);
            return;
        }
    }
    /** api call to send first card selection */
    async _sendUpdateSelection() {
        //  this.match_start.setAttribute("disabled", true);
        const action = "updateSelection";
        const body = {
            gameId: this.currentGame,
            action,
            previousCard0: this.gameData.previousCard0,
        };
        const token = await firebase.auth().currentUser.getIdToken();
        const fResult = await fetch(this.basePath + `lobbyApi/${this.apiType}/action`, {
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
        this.match_start.removeAttribute("disabled");
        if (!json.success) {
            console.log("selection send fail", json);
            if (this.alertErrors)
                alert("Failed to send selection: " + json.errorMessage);
            return;
        }
    }
    /** api call to end turn */
    async _endTurn() {
        this.match_start.setAttribute("disabled", true);
        const action = "endTurn";
        const body = {
            gameId: this.currentGame,
            action,
        };
        const token = await firebase.auth().currentUser.getIdToken();
        const fResult = await fetch(this.basePath + `lobbyApi/${this.apiType}/action`, {
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
        this.match_start.removeAttribute("disabled");
        if (!json.success) {
            console.log("selection send resolve", json);
            if (this.alertErrors)
                alert("Failed to resolve selection: " + json.errorMessage);
            return;
        }
    }
    /** api call to clear selection */
    async _clearSelection() {
        this.match_start.setAttribute("disabled", true);
        const action = "clearSelection";
        const body = {
            gameId: this.currentGame,
            action,
        };
        const token = await firebase.auth().currentUser.getIdToken();
        const fResult = await fetch(this.basePath + `lobbyApi/${this.apiType}/action`, {
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
        this.match_start.removeAttribute("disabled");
        if (!json.success) {
            console.log("selection send resolve", json);
            if (this.alertErrors)
                alert("Failed to resolve selection: " + json.errorMessage);
        }
    }
    /** create html template for card
     * @param { any } cardInfo card meta data
     * @return { any } html data
     */
    _cardTemplate(cardInfo) {
        return `<span class="card_inner" data-bkg="${btoa(cardInfo.image)}"></span>`;
    }
    /** gets card meta and totals for a card (based on shuffled deck order)
    * @return { any } meta data for a specific card
    */
    getLastCardMeta() {
        let deckIndex = 0;
        if (this.gameData.lastMatchIndex)
            deckIndex = this.gameData.lastMatchIndex;
        return this.getCardMeta(deckIndex);
    }
}
//# sourceMappingURL=matchapp.js.map