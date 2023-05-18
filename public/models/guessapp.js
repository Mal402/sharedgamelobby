import BaseApp from '/models/baseapp.js';
import GameBaseApp from '/models/gamebaseapp.js';

export class GuessApp extends GameBaseApp {
  constructor() {
    super();

    this.vowelLetters = 'AEIOU';
    this.constLetters = 'BCDFGHJKLMNPQRSTVWXYZ';

    this.apiType = 'guess';

    this.correctLetters = "";
    this._initGameCommon();

    this.turnsSpun = {};

    this.word_progress_display = document.querySelector('.word_progress_display');

    this.keyboard_container = document.querySelector('.keyboard_container');
    this.keyboard_keys = document.querySelectorAll('.keys');
    this.keyboard_keys.forEach(ctl => ctl.addEventListener('click', evt => this.keypressHandler(ctl, evt)));

    this.action_desc = document.querySelector('.action_desc');

    this.buy_vowel_button = document.querySelector('.buy_vowel_button');
    this.buy_vowel_button.addEventListener('click', e => this.showVowel());

    this.match_start = document.querySelector('.match_start');
    this.match_start.addEventListener('click', e => this.startGame());

    this.turn_number_div = document.querySelector('.turn_number_div');
    this.turn_player_number_div = document.querySelector('.turn_player_number_div');
    this.player_total_points = document.querySelector('.player_total_points');
    this.player_total_for_turn = document.querySelector('.player_total_for_turn');
    this.player_dock_prompt = document.querySelector('.player_dock_prompt');

    this.currentplayer_score_dock = document.querySelector('.currentplayer_score_dock');
    this.match_board_outer = document.querySelector('.match_board_outer');
    this.player_name = document.querySelector('.player_name');

    this.wheel_wrapper = document.querySelector('.wheel_wrapper');

    this.game_instruction_container = document.querySelector('.game_instruction_container');
    this.slidesContainer = document.querySelector(".slides-container");
    this.slide = document.querySelector(".slide");
    this.prevButton = document.querySelector(".slide-arrow-prev");
    this.prevButton.addEventListener("click", () => {
      const slideWidth = this.slide.clientWidth;
      this.slidesContainer.scrollLeft -= slideWidth;
    });

    this.nextButton = document.querySelector(".slide-arrow-next");
    this.nextButton.addEventListener("click", () => {
      const slideWidth = this.slide.clientWidth;
      this.slidesContainer.scrollLeft += slideWidth;
    });


    this.wheelPosition = -1; // 0.5 * Math.PI;

    this.spin_wheel = document.querySelector('.spin_wheel');
    this.spin_wheel.addEventListener('click', e => this.startSpin());
    this.isSpinning = false;
    this.isAccelerating = false;

    
    this.game_feed_list_toggle = document.querySelector('.game_feed_list_toggle');
    this.game_feed_list_toggle.addEventListener('click', e => this.toggleTabView());
    this.toggleTabView();
  }
  async keypressHandler(ctl, evt) {
    let guessLetter = ctl.dataset.key;

    if (this.gameData.turnPhase !== 'letter') {
      return;
    }

    let action = 'playturn';
    let body = {
      gameId: this.currentGame,
      uid: this.uid,
      action,
      guessLetter
    };
    let token = await firebase.auth().currentUser.getIdToken();
    let f_result = await fetch(this.basePath + 'webPage/guess/action', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        token
      },
      body: JSON.stringify(body)
    });
    let json = await f_result.json();
    if (!json.success) {
      console.log('pick letter failed', json);
    }
  }


  showVowel() {
    document.body.classList.toggle('turnphase_buyVowel');
  }

  wheelSpinDone() {
    setTimeout(() => {
      document.body.classList.add('wheel_done_spinning');
    }, 2000);
  }


  wheelSector() {
    const tot = this.gameData.sectors.length;
    return Math.floor(tot - this.wheelPosition / (2 * Math.PI) * tot) % tot;
  }
  wheelUI() {
    if (this.wheelSpinnerInited)
      return;

    if (this.gameData.sectors.length === 0) {
      return;
    }

    this.wheelSpinnerInited = true;

    // Generate random float in range min-max:
    const rand = (m, M) => Math.random() * (M - m) + m;
    const elSpin = this.spin_wheel;
    const ctx = document.querySelector(".wheel_canvas").getContext `2d`;
    const dia = ctx.canvas.width;
    const rad = dia / 2;
    const PI = Math.PI;
    const TAU = 2 * PI;
    const arc = TAU / this.gameData.sectors.length;
    const angVelMin = 0.005; // Below that number will be treated as a stop
    let angVel = 0; // Current angular velocity

    //* Draw sectors and prizes texts to canvas */
    const drawSector = (sector, i) => {
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
      elSpin.textContent = !angVel ? "SPIN" : sector.label;
      elSpin.style.background = sector.color;
    };



    const frame = () => {
      if (this.wheelPosition === -1)
        return;

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
        if (!angVel)
          angVel = angVelMin; // Initial velocity kick
        angVel *= 1.06; // Accelerate
      }

      // Decelerate
      else {
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
      requestAnimationFrame(engine)
    };

    if (this.isSpinning) return;
    // INIT!
    this.gameData.sectors.forEach(drawSector);
    rotate(); // Initial rotation
    engine(); // Start engine!
  }
  _updateWheelSpin() {
    if (this.gameData.mode === 'ready') {
      this.hasSpun = {};
      return;
    }
    if (this.gameData.turnPhase !== 'letter' && this.gameData.turnPhase !== 'skip')
      return;
    let turnSpinKey = this.gameData.turnNumber.toString();



    if (this.isSpinning) return;

    if (!this.turnsSpun[turnSpinKey]) {
      //this.wheelPosition = this.gameData.wheelPosition;
      this.isSpinning = true;
      this.isAccelerating = true;
      this.turnsSpun[turnSpinKey] = true;
    }
  }
  async startSpin() {
    if (this.gameData.turnPhase !== 'spin') {
      return;
    }

    //    let turnSpinKey = this.gameData.turnNumber.toString();
    //    this.turnsSpun[turnSpinKey] = false;
    let action = 'spin';
    let body = {
      gameId: this.currentGame,
      uid: this.uid,
      action
    };
    let token = await firebase.auth().currentUser.getIdToken();
    let f_result = await fetch(this.basePath + 'webPage/guess/action', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        token
      },
      body: JSON.stringify(body)
    });
    let json = await f_result.json();
    if (!json.success) {
      console.log('spin click failed', json);
    }
  }

  authUpdateStatusUI() {
    super.authUpdateStatusUI();
    this.currentGame = null;
    this.gameid_span.innerHTML = '';
    this.initRTDBPresence();

    let gameId = this.urlParams.get('game');
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
  paintGameData(gameDoc = null) {
    if (gameDoc)
      this.gameData = gameDoc.data();

    if (!this.gameData)
      return;
    if (!this.allBeers)
      return;

    if (this.wheelPosition === -1 && this.gameData.wheelPosition)
      this.wheelPosition = this.gameData.wheelPosition;

    this.wheelUI();

    this.queryStringPaintProcess();

    this.turnindex_span.innerHTML = this.gameData.turnNumber.toString();
    this.turnphase_span.innerHTML = this.gameData.turnPhase;

    this.paintOptions();
    this.paintDock();

    document.body.classList.remove('turnphase_spin');
    document.body.classList.remove('turnphase_letter');
    document.body.classList.remove('turnphase_buyVowel');
    document.body.classList.remove('wheel_done_spinning');

    let cSeat = this.gameData.currentSeat;
    this.player_name.innerHTML = this.gameData.memberNames[this.gameData['seat' + cSeat]];

    let keyboard = this.keyboard_container;
    let phase = "Spin";
    if (this.gameData.turnPhase)
      phase = this.gameData.turnPhase;
    document.body.classList.add('turnphase_' + phase);

    let phaseDesc = '';
    if (this.gameData.turnPhase === 'spin') {
      phaseDesc = 'Spin Wheel';
      let turnSpinKey = this.gameData.turnNumber.toString();
      this.turnsSpun[turnSpinKey] = false;
      this.wheel_wrapper.style.display = 'inline-flex';
      this.player_total_for_turn.innerHTML = 'Ready to Spin';
    }

    let spin_sector_result = '';
    let sectors = this.gameData.sectors;
    let spin_result = '';
    let seatIndex = "0";
    if (this.gameData.currentSeat)
      seatIndex = this.gameData.currentSeat.toString();

    this.turn_player_number_div.innerHTML = (this.gameData.currentSeat + 1).toString();
    this.turn_number_div.innerHTML = (this.gameData.turnNumber + 1).toString();
    let pts = this.gameData['seatPoints' + seatIndex];
    this.player_total_points.innerHTML = '$' + pts;


    if (this.gameData.turnPhase === 'letter') {
      phaseDesc = 'Pick Letter';
      spin_sector_result = this.gameData.turnSpinResults[this.gameData.turnNumber];
      spin_result = sectors[spin_sector_result];
      this.player_total_for_turn.innerHTML = '💰&nbsp;' + '$' + spin_result.points;
    }

    this.player_dock_prompt.innerHTML = phaseDesc;

    this.match_board_outer.classList.remove('seat_color_0');
    this.match_board_outer.classList.remove('seat_color_1');
    this.match_board_outer.classList.remove('seat_color_2');
    this.match_board_outer.classList.remove('seat_color_3');
    this.currentplayer_score_dock.classList.remove('seat_color_0');
    this.currentplayer_score_dock.classList.remove('seat_color_1');
    this.currentplayer_score_dock.classList.remove('seat_color_2');
    this.currentplayer_score_dock.classList.remove('seat_color_3');

    //  this.match_board_outer.classList.add('seat_color_' + seatIndex);
    this.currentplayer_score_dock.classList.add('seat_color_' + seatIndex);

    let breweryList = Object.keys(window.breweryJSON);
    let breweryNames = [];
    breweryList.forEach(slug => breweryNames.push(window.breweryJSON[slug].name));
    breweryNames = breweryNames.sort();

    let brewery_html = '<option>All Breweries</option>';
    breweryNames.forEach(name => {
      if (name)
        brewery_html += `<option>${name}</option>`
    });

    this.htmlForBeerTitle();
    this.gamePaintSeats();
    this.updateKeyboardStatus();
    this.updateUserPresence();
    this._updateGameMembersList();

    this._updateWheelSpin();
  }
  htmlForBeerTitle() {
    this.word_progress_display.innerHTML = '';
    if (!this.gameData)
      return;

    this.correctLetters = "";

    let html = '';

    let gName = this.gameData.solutionText;
    let chars = Array.from(gName);
    html += '<div class="hangbeer_word">';
    chars.forEach(char => {
      if (char !== ' ') {
        let d = char;

        if (this.gameData.letters.indexOf(char.toUpperCase()) === -1)
          d = '&nbsp;&nbsp;';
        else if (this.correctLetters.indexOf(char.toUpperCase()) === -1)
          this.correctLetters += char.toUpperCase();
        html += '<span class="hangbeer_char">' + d + '</span>';
      } else
        html += '</div> &nbsp; <div class="hangbeer_word">';
    });
    html += '</div>';
    this.word_progress_display.innerHTML = html;
  }
  updateKeyboardStatus() {
    let updateKey = (ctl) => {
      let key = ctl.dataset.key.toUpperCase();
      ctl.classList.remove("hide_used");
      if (this.correctLetters.indexOf(key) !== -1)
        ctl.classList.add("hide_used");
      else if (this.gameData.letters.indexOf(key) !== -1)
        ctl.classList.add("hide_used");
    };
    this.keyboard_keys.forEach(ctl => updateKey(ctl));
  }
  toggleTabView() {

    if (document.body.classList.contains('show_game_table')) {
      document.body.classList.remove('show_game_table');
      document.body.classList.add('show_game_members');
      this.game_feed_list_toggle.innerHTML = '<i class="material-icons">close</i>';
    } else {
      document.body.classList.add('show_game_table');
      document.body.classList.remove('show_game_members');
      this.game_feed_list_toggle.innerHTML = '<i class="material-icons">menu</i>';
    }

    return false;
  }
}
