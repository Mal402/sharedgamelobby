import GameBaseApp from "/models/gamebaseapp.js";

/** Game Lobby App - for listing, joining and creating games  */
export class GamesApp extends GameBaseApp {
  /** */
  constructor() {
    super();

    this.create_new_game_btn = document.querySelector(".create_new_game_btn");
    this.create_new_game_btn.addEventListener("click", () => this.createNewGame());

    this.game_history_view = document.querySelector(".game_history_view");
    this.public_game_view = document.querySelector(".public_game_view");

    this.join_game_btn = document.querySelector(".join_game_btn");
    this.join_game_btn.addEventListener("click", () => this.joinGame());

    this.gametype_select = document.querySelector(".gametype_select");
    this.gametype_select.addEventListener("input", () => this.updateNewGameType());

    const gameId = this.urlParams.get("game");
    if (gameId && this._handlePassedInGameID(gameId)) return;

    this.gamelist_header_toggle_button = document.querySelector(".gamelist_header_toggle_button");
    this.gamelist_header_toggle_button.addEventListener("click", (e) => this.toggleAddGameView(e));

    this.game_feed_toggle_button = document.querySelector(".game_feed_toggle_button");
    this.game_feed_toggle_button.addEventListener("click", (e) => this.toggleFeedView(e));

    this.feed_expand_all = document.querySelector(".feed_expand_all");
    this.feed_expand_all.addEventListener("click", () => this.toggleFeedMembers());

    this.new_game_type_wrappers = document.querySelectorAll(".new_game_type_wrapper");
    this.new_game_type_wrappers.forEach((btn) => btn.addEventListener("click", () => this.handleGameTypeClick(btn)));

    this.basic_options = document.querySelector(".basic_options");

    this.updateNewGameType();

    this.recentExpanded = {};

    this.initRTDBPresence();
    // redraw feeds to update time since values
    setInterval(() => this.updateGamesFeed(), this.baseRedrawFeedTimer);
    setInterval(() => this.updatePublicGamesFeed(), this.baseRedrawFeedTimer);
  }
  /** game type radios change handler
   * @param { any } btn dom ctl
   */
  handleGameTypeClick(btn) {
    this.new_game_type_wrappers.forEach((b) => b.classList.remove("selected"));
    this.gametype_select.value = btn.value;
    this.updateNewGameType();
    btn.classList.add("selected");
  }
  /** toggle show/hide UI members in UI */
  toggleFeedMembers() {
    if (this.feed_expand_all.classList.contains("expanded_all")) {
      this.feed_expand_all.classList.remove("expanded_all");

      document.querySelectorAll(".gamelist_item").forEach((div) => {
        div.classList.remove("show_seats");
        const gameNumber = div.dataset.gamenumber;
        this.recentExpanded[gameNumber] = false;
      });
    } else {
      this.feed_expand_all.classList.add("expanded_all");

      document.querySelectorAll(".gamelist_item").forEach((div) => {
        div.classList.add("show_seats");
        const gameNumber = div.dataset.gamenumber;
        this.recentExpanded[gameNumber] = true;
      });
    }
  }
  /** updates expand all button to open or closed if all child cards are opened or closed */
  _updateFeedToggleButtonStatus() {
    const p = document.body.classList.contains("show_public_games_view");
    const prefix = (p) ? ".public_game_view " : ".game_history_view ";
    const items = document.querySelectorAll(prefix + ".gamelist_item");

    let allOpen = true;
    let allClosed = true;
    items.forEach((i) => {
      if (i.classList.contains("show_seats")) {
        allClosed = false;
      } else {
        allOpen = false;
      }
    });

    if (allClosed && !allOpen) {
      this.feed_expand_all.classList.remove("expanded_all");
    }
    if (allOpen && !allClosed) {
      this.feed_expand_all.classList.add("expanded_all");
    }
  }
  /** toggle add game view or show games list views
   * @param { any } e dom event (preventDefault called if passed)
   * @return { boolean } true to stop anchor navigation
  */
  toggleAddGameView(e) {
    if (document.body.classList.contains("show_games_view")) {
      document.body.classList.remove("show_games_view");
      document.body.classList.add("show_new_game");
      this.gamelist_header_toggle_button.innerHTML = "<i class=\"material-icons\">games</i>";
    } else {
      document.body.classList.add("show_games_view");
      document.body.classList.remove("show_new_game");
      this.gamelist_header_toggle_button.innerHTML = "<i class=\"material-icons\">add</i>";
    }

    e.preventDefault();
    return true;
  }
  /** swaps between feeds of games where you're a member of and public games with open sees
  * @param { any } e dom event (preventDefault called if passed)
  * @return { boolean } true to stop anchor navigation
 */
  toggleFeedView(e) {
    if (document.body.classList.contains("show_public_games_view")) {
      document.body.classList.remove("show_public_games_view");
      document.body.classList.add("show_profile_games");
      this.game_feed_toggle_button.innerHTML = "<i class=\"material-icons\">search</i>";
    } else {
      document.body.classList.add("show_public_games_view");
      document.body.classList.remove("show_profile_games");
      this.game_feed_toggle_button.innerHTML = "<i class=\"material-icons\">history</i>";
    }

    this._updateFeedToggleButtonStatus();

    e.preventDefault();
    return true;
  }
  /** paint details when a specific game is selected */
  updateNewGameType() {
    document.body.classList.remove("newgametype_guess");
    document.body.classList.remove("newgametype_match");

    const gameType = this.gametype_select.value;
    document.body.classList.add("newgametype_" + gameType);

    this.basic_options.classList.remove("gametype_guess");
    this.basic_options.classList.remove("gametype_match");
    this.basic_options.classList.add("gametype_" + gameType);

    const gameMeta = this.gameTypeMetaData()[gameType];
    this.create_new_game_btn.innerHTML = "Create " + gameMeta.name;
  }
  /** handle gameid passed as query string and navigate to game
   * @param { string } gameId storage record id of game to load
   * @return { boolean } true if navigating, false if invalid game id
   */
  async _handlePassedInGameID(gameId) {
    const gameQuery = await firebase.firestore().doc(`Games/${gameId}`).get();
    const gameData = gameQuery.data();

    if (!gameData) {
      alert("game not found");
      return false;
    }

    window.history.replaceState({
      state: 1,
    }, "", `/${gameData.gameType}/?game=${gameId}`);
    location.reload();

    return true;
  }
  /** BaseApp override to update additional use profile status */
  authUpdateStatusUI() {
    super.authUpdateStatusUI();
    this.initGameFeeds();
    this.initRTDBPresence();
  }
  /** init listening events on games store to populate feeds in realtime */
  async initGameFeeds() {
    if (this.gameFeedInited || !this.profile) return;
    this.gameFeedInited = true;

    if (this.gameFeedSubscription) this.gameFeedSubscription();
    if (this.publicFeedSubscription) this.publicFeedSubscription();

    this.gameFeedSubscription = firebase.firestore().collection(`Games`)
      .orderBy(`members.${this.uid}`, "desc")
      .limit(20)
      .onSnapshot((snapshot) => this.updateGamesFeed(snapshot));

    this.publicFeedSubscription = firebase.firestore().collection(`Games`)
      .orderBy(`lastActivity`, "desc")
      .where("publicStatus", "==", "publicOpen")
      .limit(20)
      .onSnapshot((snapshot) => this.updatePublicGamesFeed(snapshot));
  }
  /** paint games feed from firestore snapshot
   * @param { any } snapshot event driven feed data from firestore
  */
  updateGamesFeed(snapshot) {
    if (snapshot) this.lastGamesFeedSnapshot = snapshot;
    else if (this.lastGamesFeedSnapshot) snapshot = this.lastGamesFeedSnapshot;
    else return;

    let html = "";
    snapshot.forEach((doc) => html += this._renderGameFeedLine(doc));
    this.game_history_view.innerHTML = html;

    this.game_history_view.querySelectorAll("button.delete_game")
      .forEach((btn) => btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.deleteGame(btn, btn.dataset.gamenumber);
      }));

    this.game_history_view.querySelectorAll("button.logout_game")
      .forEach((btn) => btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.logoutGame(btn, btn.dataset.gamenumber);
      }));

    this.game_history_view.querySelectorAll("button.toggle_expanded_game")
      .forEach((btn) => btn.addEventListener("click", () => this.toggleFeedSeats(btn)));

    this.game_history_view.querySelectorAll(".sit_button")
      .forEach((btn) => btn.addEventListener("click", () => this.gameSitClick(btn)));

    this.game_history_view.querySelectorAll(".code_link")
      .forEach((btn) => btn.addEventListener("click", () => this.copyGameLink(btn)));

    this.refreshOnlinePresence();
  }
  /** show or hide seats for a specific game
   * @param { any } btn dom element
  */
  toggleFeedSeats(btn) {
    const p = btn.parentElement.parentElement.parentElement;
    const gameNumber = btn.dataset.gamenumber;

    if (p.classList.contains("show_seats")) {
      this.recentExpanded[gameNumber] = false;
      p.classList.remove("show_seats");
    } else {
      this.recentExpanded[gameNumber] = true;
      p.classList.add("show_seats");
    }

    this._updateFeedToggleButtonStatus();
  }
  /** compact html block to display user
   * @param { string } member uid of firebase user
   * @param { string } name display name
   * @param { string } img url path of display image
   * @param { boolean } onlineStatus
   * @param { boolean } impact use impact font (shows selected)
   * @return { string } raw html containing user specific values
  */
  __getUserTemplate(member, name, img, onlineStatus = false, impact = false) {
    const impactFont = impact ? " impact-font" : "";
    let innerHTML = `<span style="background-image:url(${img});width: 30px;display: inline-block;"></span>
      <span class="name${impactFont}">${name}</span>`;
    if (onlineStatus) {
      this.addUserPresenceWatch(member);
      innerHTML += `<div class="member_online_status" data-uid="${member}"></div>`;
    }

    return innerHTML;
  }
  /** paint html list card
   * @param { any } doc Firestore doc for game
   * @param { boolean } publicFeed true if this is public open games feed
   * @return { string } html for card
  */
  _renderGameFeedLine(doc, publicFeed = false) {
    const data = doc.data();
    let ownerClass = "";
    const gnPrefix = publicFeed ? "public_" : "";
    if (data.createUser === this.uid) ownerClass += " feed_game_owner";
    const modeClass = " gameitem_" + data.mode;
    let isUserSeated = false;
    for (let c = 0; c < data.numberOfSeats; c++) {
      if (data["seat" + c] === this.uid) {
        isUserSeated = true;
        break;
      }
    }

    let membersHtml = "<div class=\"member_feed_wrapper\">";
    let memberUpHtml = "";
    const ownerHTML = this.__getUserTemplate(data.createUser, data.memberNames[data.createUser], data.memberImages[data.createUser], true);
    let memberIsUp = "";
    let openImpactFont = "";
    let displayClass = "";
    let seatsFull = true;
    if (publicFeed) {
      displayClass = " show_seats";
      if (this.recentExpanded["public_" + doc.id] === false) displayClass = "";
    } else {
      if (this.recentExpanded[doc.id]) displayClass = " show_seats";
    }
    for (let c = 0; c < data.numberOfSeats; c++) {
      if (c === 2) membersHtml += "</div><div class=\"member_feed_wrapper\">";
      const member = data["seat" + c];
      let innerHTML = "";
      if (member) {
        let name = data.memberNames[member];
        let img = data.memberImages[member];
        if (!name) name = "Anonymous";
        if (!img) img = "/images/defaultprofile.png";
        innerHTML = this.__getUserTemplate(member, name, img, !publicFeed);

        if (c === data.currentSeat) {
          memberUpHtml = this.__getUserTemplate(member, name, img, true, true);

          if (member === this.uid) {
            memberIsUp = " gameplayer_turn_next";
            openImpactFont = " impact-font";
          }
        }
      } else {
        seatsFull = false;
        if (!isUserSeated) {
          innerHTML = `<button class="sit_anchor game sit_button" data-gamenumber="${data.gameNumber}" 
            data-seatindex="${c}">
              <custom class="impact-font">Sit</custom>
            </button>`;
        } else {
          innerHTML = "<button class=\"sit_anchor game open_sit\">Empty</button>";
        }
      }

      membersHtml += `<div class="game_user_wrapper game_list_user">${innerHTML}</div>`;
    }

    if (data.numberOfSeats % 2 === 1) membersHtml += "<div class=\"table_seat_fill\"></div>";

    membersHtml += "</div>";

    const title = this.gameTypeMetaData()[data.gameType].name;
    const img = `url(${this.gameTypeMetaData()[data.gameType].icon})`;
    const timeSince = this.timeSince(new Date(data.lastActivity));
    let timeStr = this.isoToLocal(data.created).toISOString().substr(11, 5);
    let hour = Number(timeStr.substr(0, 2));
    const suffix = hour < 12 ? "am" : "pm";
    const seatsFullClass = seatsFull ? " seats_full" : "";

    hour = hour % 12;
    if (hour === 0) hour = 12;
    timeStr = hour.toString() + timeStr.substr(2) + " " + suffix;

    // let shortDate = new Date(data.created).toLocaleDateString();
    // shortDate = shortDate.substring(0, shortDate.length - 5);
    // shortDate += " " + timeStr;

    const round = (Math.floor(data.turnNumber / data.runningNumberOfSeats) + 1).toString();

    return `<div class="gamelist_item${ownerClass}${memberIsUp} gametype_${data.gameType} ${displayClass}${modeClass}${seatsFullClass}"
          data-gamenumber="${gnPrefix}${doc.id}">
      <div class="gamefeed_item_header">
        <div style="background-image:${img}" class="game_type_image"></div>
        <div class="game_name">
          <span class="title">
          ${title}
          </span>
        </div>
        <div class="open_button_wrapper">
          <a href="/${data.gameType}/?game=${data.gameNumber}" class="game_number_open game">
            <span class="${openImpactFont}">&nbsp; Open &nbsp;</span>
          </a>
        </div>
      </div>
      <div class="gamefeed_timesince"><span class="mode impact-font">${data.mode}</span> 
        - <span class="timesince">${timeSince}</span></div>
      <div style="display:flex;flex-direction:row">
        <button class="code_link game" data-url="/${data.gameType}/?game=${data.gameNumber}">
          <i class="material-icons">content_copy</i> <span>${data.gameNumber}</span></button>
        <div style="flex:1"></div>
        <div>
          <button class="game toggle_expanded_game" data-gamenumber="${gnPrefix}${data.gameNumber}">
            <span class="label">Round &nbsp; &nbsp; &nbsp;</span>
            <span class="round">${round}</span>
            <span class="icon">&#9660;</span>
          </button>
        </div>
      </div>

      <div class="next_player">
        <span class="next_label">&nbsp;Player:</span>
        <span class="next_player_wrapper game_user_wrapper">${memberUpHtml}</span>
      </div>
      <div class="gamefeed_members_list">
        ${membersHtml}
      </div>
      <div class="gamefeed_owners_panel">
        <span class="game_owner_label owner_wrapper">Game<br>Owner</span>
        <div class="owner_wrapper game_user_wrapper">
           ${ownerHTML}
        </div>

        <button class="delete_game game" data-gamenumber="${data.gameNumber}">
          <i class="material-icons">delete</i> Delete
        </button>
        <button class="logout_game game" data-gamenumber="${data.gameNumber}">
          <i class="material-icons">logout</i> Leave
        </button>
      </div>
      <div style="clear:both"></div>
    </div>`;
  }
  /** paint games feed from firestore snapshot
   * @param { any } snapshot event driven feed data from firestore
  */
  updatePublicGamesFeed(snapshot) {
    if (snapshot) this.lastPublicFeedSnapshot = snapshot;
    else if (this.lastPublicFeedSnapshot) snapshot = this.lastPublicFeedSnapshot;
    else return;

    let html = "";
    snapshot.forEach((doc) => html += this._renderGameFeedLine(doc, true));
    this.public_game_view.innerHTML = html;

    this.public_game_view.querySelectorAll("button.delete_game")
      .forEach((btn) => btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.deleteGame(btn, btn.dataset.gamenumber);
      }));

    this.public_game_view.querySelectorAll("button.toggle_expanded_game")
      .forEach((btn) => btn.addEventListener("click", () => this.toggleFeedSeats(btn)));

    this.public_game_view.querySelectorAll(".sit_button")
      .forEach((btn) => btn.addEventListener("click", () => this.gameSitClick(btn)));

    this.public_game_view.querySelectorAll(".code_link")
      .forEach((btn) => btn.addEventListener("click", () => this.copyGameLink(btn)));

    this.refreshOnlinePresence();
  }
  /** copy game url link to clipboard
   * @param { any } btn dom control
   */
  copyGameLink(btn) {
    navigator.clipboard.writeText(window.location.origin + btn.dataset.url);
  }
  /** sit down at game handler
   * @param { any } btn dom control
   */
  async gameSitClick(btn) {
    const result = await this._gameAPISit(btn.dataset.seatindex, btn.dataset.gamenumber);

    if (result) {
      btn.parentElement.parentElement.parentElement.parentElement.querySelector(".game_number_open").click();
    }
  }
  /** join game api call
   * @param { string } gameNumber
   * @param { string } gameType match or guess
   */
  async joinGame(gameNumber, gameType = "games") {
    if (!gameNumber) gameNumber = document.querySelector(".game_code_start").value;
    const a = document.createElement("a");
    a.setAttribute("href", `/${gameType}/?game=${gameNumber}`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  /** create new game api call */
  async createNewGame() {
    if (!this.profile) return;

    this.create_new_game_btn.setAttribute("disabled", true);
    this.create_new_game_btn.innerHTML = "Creating...";

    const gameType = document.querySelector(".gametype_select").value;
    const visibility = document.querySelector(".visibility_select").value;
    const numberOfSeats = Number(document.querySelector(".seat_count_select").value);
    const messageLevel = document.querySelector(".message_level_select").value;
    const seatsPerUser = document.querySelector(".seats_per_user_select").value;
    const cardDeck = document.querySelector(".card_deck_select").value;
    const scoringSystem = document.querySelector(".scoring_system_select").value;

    const body = {
      gameType,
      visibility,
      numberOfSeats,
      messageLevel,
      seatsPerUser,
      cardDeck,
      scoringSystem,
    };

    const token = await firebase.auth().currentUser.getIdToken();
    const fResult = await fetch(this.basePath + "webPage/games/create", {
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
      console.log("failed create", json);
      alert("failed to create game");
      return;
    }

    const a = document.createElement("a");
    a.setAttribute("href", `/${gameType}/?game=${json.gameNumber}`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  /** delete game api call
   * @param { any } btn dom control
   * @param { string } gameNumber
   */
  async deleteGame(btn, gameNumber) {
    if (!confirm("Are you sure you want to delete this game?")) return;

    btn.setAttribute("disabled", "true");
    if (!gameNumber) {
      alert("Game Number not found - error");
      return;
    }

    const body = {
      gameNumber,
    };
    const token = await firebase.auth().currentUser.getIdToken();
    const fResult = await fetch(this.basePath + "webPage/games/delete", {
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
    if (!result.success) {
      console.log("delete error", result);
      alert("Delete failed");
    }
  }
  /** logout api call
   * @param { any } btn dom control
   * @param { string } gameNumber
   */
  async logoutGame(btn, gameNumber) {
    btn.setAttribute("disabled", "true");
    if (!gameNumber) {
      alert("Game Number not found - error");
      return;
    }

    const body = {
      gameNumber,
    };
    const token = await firebase.auth().currentUser.getIdToken();
    const fResult = await fetch(this.basePath + "webPage/games/leave", {
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
    if (!result.success) alert("Logout failed");
  }
}