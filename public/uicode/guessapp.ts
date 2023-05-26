import GameBaseApp from "./gamebaseapp.js";
declare const firebase: any;
declare const window: any;

/** Guess app class */
export class GuessApp extends GameBaseApp {
  vowelLetters = "AEIOU";
  constLetters = "BCDFGHJKLMNPQRSTVWXYZ";
  apiType = "guess";
  correctLetters = "";
  turnsSpun: any = {};
  word_progress_display: any = document.querySelector(".word_progress_display");
  keyboard_container: any = document.querySelector(".keyboard_container");
  keyboard_keys: any = document.querySelectorAll(".keys");
  action_desc: any = document.querySelector(".action_desc");
  match_start: any = document.querySelector(".match_start");
  turn_number_div: any = document.querySelector(".turn_number_div");
  turn_player_number_div: any = document.querySelector(".turn_player_number_div");
  player_total_points: any = document.querySelector(".player_total_points");
  player_total_for_turn: any = document.querySelector(".player_total_for_turn");
  player_dock_prompt: any = document.querySelector(".player_dock_prompt");
  currentplayer_score_dock: any = document.querySelector(".currentplayer_score_dock");
  match_board_outer: any = document.querySelector(".match_board_outer");
  player_name: any = document.querySelector(".player_name");
  wheel_wrapper: any = document.querySelector(".wheel_wrapper");
  game_instruction_container: any = document.querySelector(".game_instruction_container");
  slidesContainer: any = document.querySelector(".slides-container");
  slide: any = document.querySelector(".slide");
  prevButton: any = document.querySelector(".slide-arrow-prev");
  nextButton: any = document.querySelector(".slide-arrow-next");
  next_turn_button: any = document.querySelector(".next_turn_button");
  wheelPosition = -1; // 0.5 * Math.PI;
  renderedWheelPosition = -1;
  spin_wheel: any = document.querySelector(".spin_wheel");
  isSpinning = false;
  isAccelerating = false;
  game_feed_list_toggle: any = document.querySelector(".game_feed_list_toggle");
  wheelSpinnerInited = false;
  wheel_canvas: any = document.querySelector(".wheel_canvas");
  hasSpun: any = {};
  currentGame: any;
  gameSubscription: any;

  /**  */
  constructor() {
    super();

    this._initGameCommon();
    this.keyboard_keys.forEach((ctl: any) => ctl.addEventListener("click", () => this.keypressHandler(ctl)));

    this.prevButton.addEventListener("click", () => {
      const slideWidth = this.slide.clientWidth;
      this.slidesContainer.scrollLeft -= slideWidth;
    });

    this.nextButton.addEventListener("click", () => {
      const slideWidth = this.slide.clientWidth;
      this.slidesContainer.scrollLeft += slideWidth;
    });

    this.spin_wheel.addEventListener("click", () => this.startSpin());
    this.game_feed_list_toggle.addEventListener("click", (e: any) => this.toggleOptionsView(e));
    this.toggleOptionsView(null);

    this.next_turn_button.addEventListener("click", () => this.nextTurn());
  }
  /** advance game to next turn */
  async nextTurn(): Promise<void> {
    if (this.gameData.turnPhase !== "turnover") return;

    const action = "nextturn";
    const body = {
      gameId: this.currentGame,
      uid: this.uid,
      action,
    };
    const token = await firebase.auth().currentUser.getIdToken();
    const fResult = await fetch(this.basePath + "lobbyApi/guess/action", {
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
    if (!json.success) console.log("next turn action failed", json);
  }
  /** handles keyboard click by user
   * @param { any } ctl dom button clicked
   */
  async keypressHandler(ctl: any): Promise<void> {
    if (this.gameData.turnPhase !== "letter") return;

    const guessLetter = ctl.dataset.key;
    const action = "playturn";
    const body = {
      gameId: this.currentGame,
      uid: this.uid,
      action,
      guessLetter,
    };
    const token = await firebase.auth().currentUser.getIdToken();
    const fResult = await fetch(this.basePath + "lobbyApi/guess/action", {
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
    if (!json.success) console.log("pick letter failed", json);
  }
  /** paint wheel done spinning */
  wheelSpinDone() {
    setTimeout(() => {
      document.body.classList.add("wheel_done_spinning");
    }, 500);
  }
  /** calculate wheel sector from position
   * @return { number }
   */
  wheelSector(): number {
    const tot = this.gameData.sectors.length;
    return Math.floor(tot - this.wheelPosition / (2 * Math.PI) * tot) % tot;
  }
  /** paint wheel UI */
  wheelUI() {
    if (this.wheelSpinnerInited) return;
    if (this.gameData.sectors.length === 0) return;

    this.wheelSpinnerInited = true;

    // Generate random float in range min-max:
    // const rand = (m, M) => Math.random() * (M - m) + m;
    const elSpin = this.spin_wheel;
    const ctx = this.wheel_canvas.getContext("2d");
    const dia = ctx.canvas.width;
    const rad = dia / 2;
    const PI = Math.PI;
    const TAU = 2 * PI;
    const arc = TAU / this.gameData.sectors.length;
    const angVelMin = 0.005; // Below that number will be treated as a stop
    let angVel = 0; // Current angular velocity

    //* Draw sectors and prizes texts to canvas */
    const drawSector = (sector: any, i: number) => {
      const ang = arc * i;
      ctx.save();
      // COLOR
      ctx.beginPath();
      ctx.fillStyle = sector.color;
      ctx.moveTo(rad, rad);
      ctx.arc(rad, rad, rad, ang, ang + arc);
      ctx.lineTo(rad, rad);
      ctx.fill();
      // TEXT
      ctx.translate(rad, rad);
      ctx.rotate(ang + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText(sector.label, rad - 10, 10);
      //
      ctx.restore();
    };

    //* CSS rotate CANVAS Element */
    const rotate = () => {
      const sector = this.gameData.sectors[this.wheelSector()];
      ctx.canvas.style.transform = `rotate(${this.wheelPosition - PI / 2}rad)`;
      const spinLabel = this.currentUserTurn ? "SPIN" : "";
      this.spin_wheel.textContent = !angVel ? spinLabel : sector.label;
      elSpin.style.background = !angVel ? "rgb(100,100,100)" : sector.color;
    };

    const frame = () => {
      if (this.wheelPosition === -1) return;

      if (!this.isSpinning) {
        if (this.renderedWheelPosition !== this.wheelPosition) {
          this.renderedWheelPosition = this.wheelPosition;
          rotate();
        }
        return;
      }

      if (angVel >= this.gameData.randomSpin) this.isAccelerating = false;

      // Accelerate
      if (this.isAccelerating) {
        if (!angVel) angVel = angVelMin; // Initial velocity kick
        angVel *= 1.06; // Accelerate
      } else { // Decelerate
        this.isAccelerating = false;
        angVel *= this.gameData.friction; // Decelerate by friction

        // SPIN END:
        if (angVel < angVelMin) {
          this.isSpinning = false;
          angVel = 0;
          this.wheelSpinDone();
        }
      }

      this.wheelPosition += angVel; // Update angle
      this.wheelPosition %= TAU; // Normalize angle
      rotate(); // CSS rotate!
    };

    const engine = () => {
      frame();
      requestAnimationFrame(engine);
    };

    if (this.isSpinning) return;
    // INIT!
    this.gameData.sectors.forEach(drawSector);
    rotate(); // Initial rotation
    engine(); // Start engine!
  }
  /**  */
  _updateWheelSpin() {
    if (this.gameData.mode === "ready") {
      this.hasSpun = {};
      return;
    }
    if (this.gameData.turnPhase !== "letter" && this.gameData.turnPhase !== "turnover") return;
    const turnSpinKey = this.gameData.turnNumber.toString();

    if (this.isSpinning) return;

    if (!this.turnsSpun[turnSpinKey]) {
      // this.wheelPosition = this.gameData.wheelPosition;
      this.isSpinning = true;
      this.isAccelerating = true;
      this.turnsSpun[turnSpinKey] = true;
    }
  }
  /** api call to start spin */
  async startSpin() {
    if (this.gameData.turnPhase !== "spin") return;
    const action = "spin";
    const body = {
      gameId: this.currentGame,
      uid: this.uid,
      action,
    };
    const token = await firebase.auth().currentUser.getIdToken();
    const fResult = await fetch(this.basePath + "lobbyApi/guess/action", {
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
      console.log("spin click failed", json);
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

      if (this.gameSubscription) this.gameSubscription();
      this.gameSubscription = firebase.firestore().doc(`Games/${this.currentGame}`)
        .onSnapshot((doc: any) => this.paintGameData(doc));
    }
  }
  /** paint game data (game document change handler)
   * @param { any } gameDoc firestore query snapshot
   */
  paintGameData(gameDoc: any = null) {
    if (gameDoc) this.gameData = gameDoc.data();
    if (!this.gameData) return;
    if (!this.allBeers) return;

    if (this.wheelPosition === -1 && this.gameData.wheelPosition) this.wheelPosition = this.gameData.wheelPosition;
    if (this.gameData.turnPhase === "spin" && this.gameData.turnNumber === 0) {
      this.wheelPosition = this.gameData.wheelPosition;
    }

    this.queryStringPaintProcess();

    this.turnphase_span.innerHTML = this.gameData.turnPhase;

    this.paintOptions();
    this.paintDock();
    this._paintDockSeats(".match_end_result ");

    this.paintSounds();

    document.body.classList.remove("turnphase_spin");
    document.body.classList.remove("turnphase_turnover");
    document.body.classList.remove("turnphase_letter");
    document.body.classList.remove("wheel_done_spinning");

    const spinLabel = this.currentUserTurn ? "SPIN" : "";
    this.spin_wheel.textContent = spinLabel;

    const cSeat = this.gameData.currentSeat;
    this.player_name.innerHTML = this.gameData.memberNames[this.gameData["seat" + cSeat]];

    let phase = "Spin";
    if (this.gameData.turnPhase) phase = this.gameData.turnPhase;
    document.body.classList.add("turnphase_" + phase);

    let phaseDesc = "";
    if (this.gameData.turnPhase === "spin") {
      this.wheelPosition = this.gameData.wheelPosition;

      phaseDesc = "Spin Wheel";
      const turnSpinKey = this.gameData.turnNumber.toString();
      this.turnsSpun[turnSpinKey] = false;
      this.wheel_wrapper.style.display = "inline-flex";
      this.player_total_for_turn.innerHTML = "Ready to Spin";
    }
    if (this.gameData.turnPhase === "turnover") {
      phaseDesc = "Turn Over";
      //      this.wheelPosition
    }

    const sectors = this.gameData.sectors;
    let seatIndex = "0";
    if (this.gameData.currentSeat) seatIndex = this.gameData.currentSeat.toString();

    this.turn_player_number_div.innerHTML = (this.gameData.currentSeat + 1).toString();
    this.turn_number_div.innerHTML = (this.gameData.turnNumber + 1).toString();
    const pts = this.gameData["seatPoints" + seatIndex];
    this.player_total_points.innerHTML = "$" + pts;

    if (this.gameData.turnPhase === "letter") {
      phaseDesc = "Pick Letter";
      const sector = this.gameData.turnSpinResults[this.gameData.turnNumber];
      const spin = sectors[sector];
      this.player_total_for_turn.innerHTML = "💰&nbsp;" + "$" + spin.points;
    }

    this.player_dock_prompt.innerHTML = phaseDesc;

    this.match_board_outer.classList.remove("seat_color_0");
    this.match_board_outer.classList.remove("seat_color_1");
    this.match_board_outer.classList.remove("seat_color_2");
    this.match_board_outer.classList.remove("seat_color_3");
    this.currentplayer_score_dock.classList.remove("seat_color_0");
    this.currentplayer_score_dock.classList.remove("seat_color_1");
    this.currentplayer_score_dock.classList.remove("seat_color_2");
    this.currentplayer_score_dock.classList.remove("seat_color_3");

    //  this.match_board_outer.classList.add("seat_color_" + seatIndex);
    this.currentplayer_score_dock.classList.add("seat_color_" + seatIndex);

    this.wheelUI();

    this.htmlForBeerTitle();
    this.gamePaintSeats();
    this.updateKeyboardStatus();
    this._updateGameMembersList();
    this._updateWheelSpin();
    this._updateFinishStatus();
    this.updateUserPresence();
  }
  /** override to add turn phase sounds */
  paintSounds(): void {
    super.paintSounds();
    if (!this.gameData) return;
    if (!this.muted) {
      if (this.currentUserTurn && this.gameData.mode === "running") {
        if (this.soundGameStateCache.turnNumber !== this.gameData.turnNumber &&
          this.gameData.turnNumber !== 0) {
          const audio = this.audios.get("turnstart");
          audio.currentTime = 0;
          this.playAudio(audio);
          setTimeout(() => audio.pause(), 1000);
        }
      }

      if ((this.gameData.turnPhase === "letter" || this.gameData.turnPhase === "turnover") &&
        (this.gameData.turnPhase !== this.soundGameStateCache.turnPhase)) {
        const audio = this.audios.get("wheelspin");
        audio.currentTime = 0;
        this.playAudio(audio);
        setTimeout(() => audio.pause(), 5000);
      }
    }

    this.soundGameStateCache.currentUserTurn = this.currentUserTurn;
    this.soundGameStateCache.turnNumber = this.gameData.turnNumber;
    this.soundGameStateCache.turnPhase = this.gameData.turnPhase;
  }
  /** override and add a sound */
  loadAudios() {
    super.loadAudios();
    this.addAudio("wheelspin", "/images/wheelspin.mp3");
  }
  /** html frag for beer title */
  htmlForBeerTitle() {
    this.word_progress_display.innerHTML = "";
    if (!this.gameData) return;
    this.correctLetters = "";
    let html = "";
    const gName = this.gameData.solutionText;
    const chars = Array.from(gName);
    html += "<div class=\"hangbeer_word\">";
    chars.forEach((char: any) => {
      if (char !== " ") {
        let d = char;

        if (this.gameData.letters.indexOf(char.toUpperCase()) === -1) d = "&nbsp;&nbsp;";
        else if (this.correctLetters.indexOf(char.toUpperCase()) === -1) this.correctLetters += char.toUpperCase();
        html += "<span class=\"hangbeer_char\">" + d + "</span>";
      } else {
        html += "</div> &nbsp; <div class=\"hangbeer_word\">";
      }
    });
    html += "</div>";
    this.word_progress_display.innerHTML = html;
  }
  /** */
  updateKeyboardStatus() {
    this.keyboard_keys.forEach((ctl: any) => {
      const key = ctl.dataset.key.toUpperCase();
      ctl.classList.remove("hide_used");
      if (this.correctLetters.indexOf(key) !== -1) ctl.classList.add("hide_used");
      else if (this.gameData.letters.indexOf(key) !== -1) ctl.classList.add("hide_used");
    });
  }
  /** show/hide members list
   * @param { any } e event to prevent default
   */
  toggleOptionsView(e: any) {
    if (document.body.classList.contains("show_game_table")) {
      document.body.classList.remove("show_game_table");
      document.body.classList.add("show_game_members");
      this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">close</i>";
    } else {
      document.body.classList.add("show_game_table");
      document.body.classList.remove("show_game_members");
      this.game_feed_list_toggle.innerHTML = "<i class=\"material-icons\">menu</i>";
    }
    if (e) e.preventDefault();
  }
  /** gets card meta and totals
  * @return { any } meta data for beer
  */
  getLastCardMeta(): any {
    const beerSlug = this.gameData.beerSlug;
    const beerData = window.allBeers[beerSlug];
    const fullName = this.gameData.solutionText;
    return {
      img: beerData.mapImage,
      fullName,
      beerSlug,
    };
  }
}
