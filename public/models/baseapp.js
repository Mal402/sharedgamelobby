export class BaseApp {
  constructor() {
    this.baseRedrawFeedTimer = 90000;
    this.feedLimit = 10;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPWAInstallPrompt = e;
    });
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js');

    this.projectId = firebase.app().options.projectId;
    this.basePath = `https://us-central1-${this.projectId}.cloudfunctions.net/`;
    if (window.location.hostname === 'localhost')
      this.basePath = `http://localhost:5001/${this.projectId}/us-central1/`;

    this.urlParams = new URLSearchParams(window.location.search);
    this.startBeer = this.urlParams.get('beer');
    this.startTag = this.urlParams.get('tag');

    this.filterTagsList = [];
    this.muted = false;

    this.night_mode_toggle = document.querySelector('.night_mode_toggle');
    if (this.night_mode_toggle)
      this.night_mode_toggle.addEventListener('click', e => this.nightModeToggle(e));

    this.search_bar = document.body.querySelector(".search_bar");
    if (this.search_bar) {
      this.search_bar.innerHTML = '<div class="search_results"></div>';
      this.search_results = document.body.querySelector(".search_results");
      this.search_box_input = document.body.querySelector(".search_box_input");
      this.search_box_input.addEventListener("input", e => this.searchChange());
      this.search_box_clear = document.body.querySelector(".search_box_clear");
      this.search_box_clear.addEventListener("click", e => {
        this.search_box_input.value = "";
        this.searchChange();
        e.preventDefault();
        return true;
      })
    }

    firebase.auth().onAuthStateChanged(u => this.authHandleEvent(u));
    this.signInWithURL();
    this.collapse_headers = document.querySelectorAll('.collapse_header');
    this.collapse_headers.forEach(ctl => ctl.addEventListener('click', e => this.toggleCollapsePanel(ctl, e)));

    this.feed_list_wrapper = document.querySelector('.feed_list_wrapper');
    this.store_taste_report_list = document.querySelector('.store_taste_report_list');
    this.brewery_taste_report_list = document.querySelector('.brewery_taste_report_list');

    this.filter_radios = document.querySelectorAll('.filter_panel input');
    this.filter_radios.forEach(ctl => ctl.addEventListener('input', e => this.initReportsFeed(true)));

    this.load_more_button = document.querySelector('.load_more_button');
    if (this.load_more_button)
      this.load_more_button.addEventListener('click', e => this.feedLoadMore());

    window.addEventListener('scroll', () => {
      const {
        scrollTop,
        scrollHeight,
        clientHeight
      } = document.documentElement;

      if (this.reportsInited) {
        if (scrollTop + clientHeight >= scrollHeight * .7) {
          this.feedLoadMore();
        }
      }
    }, {
      passive: true
    });

    let winHash = window.location.hash.substr(1);
    if (winHash) {
      let ctl = document.getElementById(winHash);
      if (ctl) {
        ctl.classList.remove('collapsed');
        //let hdr = ctl.querySelector('.collapse_header');
        //if (hdr)
        //  hdr.classList.add('impact-font')
      }
    }

    this.load();
  }
  async load() {
    let promises = [];
    promises.push(this.readJSONFile(`/data/breweryMap.json`, 'breweryJSON'));
    promises.push(this.readJSONFile(`/data/beerMap.json`, 'allBeers'));
    promises.push(this.readJSONFile(`/data/beerTags.json`, 'beerTagsMap'));
    promises.push(this.readJSONFile(`/data/trending.json`, 'trendingMap'));
    promises.push(this.readJSONFile(`/data/storeMap.json`, 'storesJSON'));
    promises.push(this.readJSONFile(`/data/beerTotals.json`, 'beerTotals'));
    await Promise.all(promises);

    this.tagList = Object.keys(window.beerTagsMap);
    this.tagList = this.tagList.sort();

    this.generateColors();

    this.allBeers = window.allBeers;

    this.authUpdateStatusUI();
    if (this.loadCallback)
      this.loadCallback();
  }
  async readJSONFile(path, varName) {
    if (window[varName]) return;

    try {
      let response = await fetch(path);
      window[varName] = await response.json();
    } catch (e) {
      console.log('ERROR with download of ' + varName, e);
      window[varName] = {};
    }
  }
  authUpdateStatusUI() {
    let html = '';
    document.body.classList.add('loaded');
    if (this.fireToken) {
      html = 'Profile';

      if (document.body.dataset.creator === this.uid)
        document.body.classList.add('user_editable_record');
    } else {
      html = 'Sign In';
    }
    if (this.profile_status_label)
      this.profile_status_label.innerHTML = html;

    if (this.profile) {
      this.updateNightModeStatus(this.profile.nightModeState);
      this.updateUserStatus();
      this.updateMute(this.profile.muteState);
    }
  }
  async authHandleEvent(user) {
    //ignore unwanted events
    if (user && this.uid === user.uid) {
      return;
    }
    if (user) {
      this.fireUser = user;
      this.uid = this.fireUser.uid;
      this.fireToken = await user.getIdToken();
      document.body.classList.add('app_signed_in');
      document.body.classList.remove('app_signed_out');
      if (this.fireUser.isAnonymous)
        document.body.classList.add('signed_in_anonymous');

      await this._authInitProfile();
    } else {
      this.fireToken = null;
      this.fireUser = null;
      this.uid = null;
      document.body.classList.remove('app_signed_in');
      document.body.classList.add('app_signed_out');
      this.authUpdateStatusUI();
    }

    return;
  }
  async _authInitProfile() {
    this.profileSubscription = firebase.firestore().doc(`Users/${this.uid}`)
      .onSnapshot(async snapshot => {
        this.profileInited = true;
        this.profile = snapshot.data();
        if (!this.profile) {
          if (this.fireUser.email) {
            let result = await firebase.auth().fetchSignInMethodsForEmail(this.fireUser.email);
  
            //user was deleted dont create new profile
            if (result.length < 1)
              return;
          }

          await this._authCreateDefaultProfile();
        }

        this.authUpdateStatusUI();
      });
  }
  async _authCreateDefaultProfile() {
    this.profile = {
      points: 0,
      locationTrack: false,
      favoriteBeer: null,
      favoriteStore: null,
      favoriteBrewery: null,
      excludeBeer: {},
      excludeStore: {},
      excludeBrewery: {},
      displayName: '',
      displayImage: ''
    };

    await firebase.firestore().doc(`Users/${this.uid}`).set(this.profile);
  }
  updateUserStatus() {
    let email = firebase.auth().currentUser.email;
    if (!email)
      email = 'Anonymous Login';
    else
      email = email;


    let defaultMsg = 'Reviewing beers allows us personalize your taste profile.';

    let reviewCount = 0;
    if (this.profile.beerReviews) {
      reviewCount = Object.keys(this.profile.beerReviews).length;
    }

    if (reviewCount < 1) {

    } else if (reviewCount < 10) {
      defaultMsg = `${reviewCount} reviewed so far - keep on going to improve your taste profile`;
    } else {
      defaultMsg = `${reviewCount} beers reviewed.<br><br> You're better now then ever!`;
    }
  }
  async updateProfileAudioMode(ctl, index, e) {
    let mute = false;
    if (index === 0)
      mute = true;
    let updatePacket = {
      muteState: mute
    };
    if (this.fireToken)
      await firebase.firestore().doc(`Users/${this.uid}`).update(updatePacket);
  }
  async updateProfileNightMode(ctl, index, e) {
    let updatePacket = {
      nightModeState: index
    };
    this.updateNightModeStatus(index);
    if (this.fireToken)
      await firebase.firestore().doc(`Users/${this.uid}`).update(updatePacket);
  }
  updateNightModeStatus(state = 0) {
    let nite = false;
    if (state === 2)
      nite = true;
    if (state === 0)
      if (new Date().getHours() < 8 || new Date().getHours() > 18)
        nite = true;
    this.nightModeCurrent = nite;

    if (nite)
      document.body.classList.add('night_mode');
    else
      document.body.classList.remove('night_mode');
  }
  nightModeToggle(e) {
    let niteMode = 2;
    if (this.nightModeCurrent)
      niteMode = 1;
    this.updateNightModeStatus(niteMode);
    this.updateProfileNightMode(null, niteMode, null);
    e.preventDefault();
    return true;
  }
  async updateMute(muted) {
    this.muted = muted;
    if (!this.mute_button)
      return;

    if (muted) {
      this.mute_button.children[0].innerHTML = 'volume_off';
      if (this.pickAudio)
        this.pickAudio.pause();
      if (this.downAudio)
        this.downAudio.pause();
      if (this.upAudio)
        this.upAudio.pause();
      if (this.lockAudio)
        this.lockAudio.pause();

      muted = true;
    } else {
      this.mute_button.children[0].innerHTML = 'volume_up';
      muted = false;
    }
    if (this.profile) {
      let updatePacket = {
        muteState: muted
      };
      await firebase.firestore().doc(`Users/${this.uid}`).update(updatePacket);
    }
  }
  async authGoogleSignIn(e) {
    e.preventDefault();
    this.provider = new firebase.auth.GoogleAuthProvider();
    this.provider.setCustomParameters({
      'display': 'popup'
    });
    await firebase.auth().signInWithPopup(this.provider);
    setTimeout(() => {
      location.href = '/';
    }, 1);

  }
  async signInAnon(e) {
    e.preventDefault();
    await firebase.auth().signInAnonymously();
    setTimeout(() => {
      location.href = '/';
    }, 1);
    return true;
  }
  async signInByEmail(e) {
    e.preventDefault();

    let email = '';
    if (this.login_email)
      email = this.login_email.value;

    /*
    if (!email) {
      email = window.prompt('Please provide your email to send link');
    }*/

    if (!email) {
      alert("A valid email is required for sending a link");
      return;
    }
    let actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true
    };

    await firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);

    window.localStorage.setItem('emailForSignIn', email);
    alert('Email Sent');
  }
  signInWithURL() {
    if (!firebase.auth().isSignInWithEmailLink)
      return;
    if (firebase.auth().isSignInWithEmailLink(window.location.href) !== true)
      return;

    let email = window.localStorage.getItem('emailForSignIn');
    if (!email)
      email = window.prompt('Please provide your email for confirmation');

    firebase.auth().signInWithEmailLink(email, window.location.href)
      .then((result) => this.__finishSignInURL(result.user))
      .catch(e => console.log(e));
  }
  __finishSignInURL(user) {
    window.localStorage.removeItem('emailForSignIn');
    location = '/profile';
    //this.authHandleEvent(user);
  }
  generateColors() {

    this.tagList = Object.keys(window.beerTagsMap);
    this.tagList = this.tagList.sort();

    this.tagColorsArrays = [];
    this.tagList.forEach(tag => {
      let color = [250, 190, 50];
      if (window.beerTagsMap[tag] === 'bitter')
        color = [40, 240, 40];
      if (window.beerTagsMap[tag] === 'distinct')
        color = [255, 0, 255];

      this.tagColorsArrays.push(color)
    });


    // r, g, b
    this.tagPens = [];
    this.tagColors = [];
    for (let c = 0; c < this.tagColorsArrays.length; c++) {
      let r = this.tagColorsArrays[c][0];
      let g = this.tagColorsArrays[c][1];
      let b = this.tagColorsArrays[c][2];

      this.tagColors.push(`rgb(${r}, ${g}, ${b})`);

      let fc = 'white';
      if (r / 255 + (g / 255 * 1.5) + b / 255 > 1.4)
        fc = 'black';
      this.tagPens.push(fc);
    }
  }
  calcBeerTags(beer) {
    let data = window.beerTotals.beers[beer];
    if (!data) {
      return {};
    }
    let tags = data.sortedTags;
    let tagthreshold = data[tags[0]];
    for (let c = 1; c < 4; c++)
      if (data[tags[c]] > tagthreshold)
        tagthreshold = data[tags[c]];

    let levels = [];
    let backgroundColors = [];
    let colors = [];
    let returnTags = [];
    for (let c = 0; c < 4; c++) {
      levels.push(data[tags[c]] / tagthreshold);
      let index = this.tagList.indexOf(tags[c]);
      backgroundColors.push(this.tagColors[index]);
      colors.push(this.tagPens[index]);
      returnTags.push(tags[c]);
    }

    return {
      threshold: tagthreshold,
      levels,
      backgroundColors,
      colors,
      tags: returnTags
    }
  }d
  gameNameForBeer(beer, option = 0) {
    let beerData = this.allBeers[beer];
    if (!beerData)
      return "missing name";
    let name = beerData.name;
    if (!name) name = 'Missing Name';
    let slugs = beer.split(':');
    let brewerySlug = slugs[0];
    let brewery = window.breweryJSON[brewerySlug];
    let bName = brewery.name;
    if (beerData.breweryName)
      bName = beerData.breweryName;

    if (option === 1)
      return name + ', ' + bName;
    return bName + ' ' + name;
  }
  _shuffleArray(array) {
    let currentIndex = array.length,
      randomIndex;
    while (0 !== currentIndex) {

      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]
      ];
    }
    return array;
  }
  _getBeerMapImage(mapImage) {
    if (!mapImage)
      return '/images/emptycan.png';

    return mapImage;
  }

  processSearchTerm(hits, mySearchTerm, container) {
    let html = "";
    container.innerHTML = '';
    let counter = 0;
    hits.forEach(hit => {
      if (hit.type === "beer") {
        let brewery = breweryJSON[hit.brewerySlug];
        let beerSlug = hit.brewerySlug + ":" + hit.shortBeerSlug;
        let beer = this.allBeers[beerSlug];
        let name = beer.name;
        name = this.styleSearchTerms(name, mySearchTerm);
        let b_name = beer.breweryName;
        if (!b_name)
          b_name = brewery.name;
        b_name = this.styleSearchTerms(b_name, mySearchTerm);
        if (name) {
          let div = document.createElement('div');
          div.innerHTML = `<a href="/${hit.brewerySlug}/${hit.shortBeerSlug}" class="${hit.brewerySlug} beer_search_result_anchor card_shadow">
          <img class="search_image_popup" src="${beer.mapImage}"/><br>
          <span class="brews_beer_name impact-font">${b_name} ${name}</span>
          </a>`;
          if (counter < 8) {
            container.appendChild(div.children[0]);
          } else {
            setTimeout(() => container.appendChild(div.children[0]), 50);
          }
        }
      }

      if (hit.type === "no_results") {
        container.innerHTML = `<div class="search_no_results">
        No Results Found!
        </div>`;
      }
    });
    return html;
  }
  styleSearchTerms(result, query) {
    if (!query)
      return result;
    let re = new RegExp(query.split("").map(function(x) {
      return x.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }).join("[-\\s.]*"), 'ig');
    return result.replace(re, '<span class="search_term_frag">$&</span>');
  }
  searchChange() {
    let mySearchTerm = this.search_box_input.value.toLowerCase().trim();
    let hits = [];
    let html = "";
    if (mySearchTerm !== "") {

      for (let brewerySlug in breweryJSON) {
        let brewery = breweryJSON[brewerySlug];
        let hitBrewery = false;
        if (brewery.name.toLowerCase().indexOf(mySearchTerm) !== -1) {
          hitBrewery = true;
        }
        brewery.beers.forEach(beerSlug => {
          let hit = false;
          let beerName = this.allBeers[beerSlug].name.toLowerCase();
          let beerBreweryName = "";
          if (this.allBeers[beerSlug].breweryName)
            beerBreweryName = this.allBeers[beerSlug].breweryName.toLowerCase();
          if (beerName.indexOf(mySearchTerm) !== -1 || beerBreweryName.indexOf(mySearchTerm) !== -1 || hitBrewery) {
            hit = true;
            let slugs = beerSlug.split(':');
            hits.push({
              brewerySlug: slugs[0],
              shortBeerSlug: slugs[1],
              beerSlug,
              type: "beer"
            });
          }
        });
      }
    } else {
      for (let brewerySlug in breweryJSON) {
        let brewery = breweryJSON[brewerySlug];
        let hitBrewery = false;
        brewery.beers.forEach(beerSlug => {
          let hit = false;
          hit = true;
          let slugs = beerSlug.split(':');
          hits.push({
            brewerySlug: slugs[0],
            shortBeerSlug: slugs[1],
            beerSlug,
            type: "beer"
          });
        });
      }

    }

    hits = hits.sort((a, b) => {
      if (this.allBeers[a.beerSlug].name < this.allBeers[b.beerSlug].name) {
        return -1;
      }
      if (this.allBeers[a.beerSlug].name > this.allBeers[b.beerSlug].name) {
        return 1;
      }
      return 0;
    });
    hits = hits.slice(0, 100);
    if (hits.length === 0) {
      hits.push({
        type: "no_results"
      })
    }
    this.processSearchTerm(hits, mySearchTerm, this.search_results);

    let searchClicks = this.search_results.querySelectorAll('.no_search_result');
    searchClicks.forEach(a => a.addEventListener('click', e => {
      this.search_box_input.value = a.innerHTML;
      this.search_box_input.dispatchEvent(new Event('input'));
      e.preventDefault();
      return true;
    }));

  }

  toggleCollapsePanel(ctl, e) {
    let parent = ctl.parentElement;
    if (parent.classList.contains('collapsed')) {
      parent.classList.remove('collapsed');
    } else {
      parent.classList.add('collapsed');
    }
  }
  timeSince(date) {
    let seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;

    if (interval > 1) {
      return Math.floor(interval) + ` year${Math.floor(interval) === 1 ? '' : 's'} ago`;
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + ` month${Math.floor(interval) === 1 ? '' : 's'} ago`;
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + ` day${Math.floor(interval) === 1 ? '' : 's'} ago`;
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + ` hour${Math.floor(interval) === 1 ? '' : 's'} ago`;
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + ` min${Math.floor(interval) === 1 ? '' : 's'} ago`;
    }
    //return Math.floor(seconds) + " seconds ago";
    return ' just now';
  }
  applyAutoSizeToParagraph(query = '.paragraphfit_auto', startFontSize = 40) {
    let elements = document.querySelectorAll(query);

    let results = [];

    elements.forEach(el => {
      let fontSize = startFontSize;
      el.style.fontSize = fontSize + 'px';
      let overflow = el.style.overflow;
      el.style.overflow = 'auto';
      while (el.scrollHeight > el.offsetHeight) {
        fontSize -= .5;
        if (fontSize < 6)
          break;
        el.style.fontSize = fontSize + 'px';
      }
      el.style.overflow = overflow;
    });
  }

  updateReportsDom(snapshot) {
    document.body.classList.add('feed_list_loaded');
    this.cachedSnapshot = snapshot;
    let html = '';
    snapshot.forEach((doc) => html += this._renderReportListLine(doc));
    this.feed_list_wrapper.innerHTML = html;

    if (this.cachedSnapshot.size < this.feedLimit)
      this.load_more_button.style.display = 'none';
    else
      this.load_more_button.style.display = '';

    if (!this.loadedOnce) {
      let winHash = window.location.hash.substr(1);
      if (winHash) {
        window.location = window.location.hash;
      }
    }
    this.loadedOnce = true;
  }
  feedLoadMore() {
    if (!this.cachedSnapshot)
      return;
    if (this.cachedSnapshot.size < this.feedLimit) {
      this.load_more_button.style.display = 'none';
      return;
    }

    this.load_more_button.setAttribute('disabled', 'true');
    setTimeout(() => {
      this.load_more_button.removeAttribute('disabled', 'true');
    }, 500);
    this.feedLimit += 10;
    this.reportsInited = false;
    this.initReportsFeed();
  }

  isoToLocal(startTimeISOString) {
    let startTime = new Date(startTimeISOString);
    let offset = startTime.getTimezoneOffset();
    return new Date(startTime.getTime() - (offset * 60000));
  }

  shortShowDate(d) {
    d = new Date(d);
    if (isNaN(d))
      return '';
    let str = d.toISOString().substr(0, 10);
    let mo = str.substr(5, 2);
    let ye = str.substr(2, 2);
    let da = str.substr(8, 2);
    return `${mo}/${da}/${ye}`;
  }

  muteClick(e) {
    if (!this.muted)
      this.muted = true;
    else {
      this.muted = false;
    }
    this.updateMute(this.muted);
    e.preventDefault();
    return true;
  }
}

export default BaseApp;
