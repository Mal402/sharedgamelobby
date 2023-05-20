var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/** Base class for all pages - handles authorization and low level routing for api calls, etc */
class BaseApp {
    /** constructor  */
    constructor() {
        this.baseRedrawFeedTimer = 90000;
        this.feedLimit = 10;
        this.deferredPWAInstallPrompt = null;
        this.projectId = firebase.app().options.projectId;
        this.basePath = `https://us-central1-${this.projectId}.cloudfunctions.net/`;
        this.urlParams = new URLSearchParams(window.location.search);
        this.startBeer = "";
        this.startTag = "";
        this.filterTagsList = [];
        this.muted = false;
        this.night_mode_toggle = null;
        this.tagList = [];
        this.allBeers = null;
        this.uid = null;
        this.profile = null;
        this.fireUser = null;
        this.fireToken = null;
        this.profileSubscription = null;
        this.profileInited = false;
        this.nightModeCurrent = false;
        this.mute_button = null;
        this.pickAudio = null;
        this.downAudio = null;
        this.upAudio = null;
        this.lockAudio = null;
        this.login_email = null;
        this.tagColorsArrays = [];
        this.tagPens = [];
        this.tagColors = [];
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            this.deferredPWAInstallPrompt = e;
        });
        if ("serviceWorker" in navigator)
            navigator.serviceWorker.register("/sw.js");
        if (window.location.hostname === "localhost")
            this.basePath = `http://localhost:5001/${this.projectId}/us-central1/`;
        this.startBeer = this.urlParams.get("beer");
        this.startTag = this.urlParams.get("tag");
        this.night_mode_toggle = document.querySelector(".night_mode_toggle");
        if (this.night_mode_toggle)
            this.night_mode_toggle.addEventListener("click", (e) => this.nightModeToggle(e));
        firebase.auth().onAuthStateChanged((u) => this.authHandleEvent(u));
        this.signInWithURL();
        this.load();
    }
    /** asynchronous loads - data setup  */
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            promises.push(this.readJSONFile(`/data/breweryMap.json`, "breweryJSON"));
            promises.push(this.readJSONFile(`/data/beerMap.json`, "allBeers"));
            promises.push(this.readJSONFile(`/data/beerTags.json`, "beerTagsMap"));
            promises.push(this.readJSONFile(`/data/trending.json`, "trendingMap"));
            promises.push(this.readJSONFile(`/data/storeMap.json`, "storesJSON"));
            promises.push(this.readJSONFile(`/data/beerTotals.json`, "beerTotals"));
            yield Promise.all(promises);
            this.tagList = Object.keys(window.beerTagsMap);
            this.tagList = this.tagList.sort();
            this._generateColors();
            this.allBeers = window.allBeers;
            this.authUpdateStatusUI();
        });
    }
    /** reads a json file async and sets window.varName to it's value
     * @param { string } path url to json data
     * @param { string } varName window.variable to hold data
     */
    readJSONFile(path, varName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (window[varName])
                return;
            try {
                const response = yield fetch(path);
                window[varName] = yield response.json();
            }
            catch (e) {
                console.log("ERROR with download of " + varName, e);
                window[varName] = {};
            }
        });
    }
    /** Paints UI display/status for user profile based changes */
    authUpdateStatusUI() {
        document.body.classList.add("loaded");
        if (this.fireToken) {
            if (document.body.dataset.creator === this.uid)
                document.body.classList.add("user_editable_record");
        }
        if (this.profile) {
            this.updateNightModeStatus(this.profile.nightModeState);
            this.updateUserStatus();
            this.updateMute(this.profile.muteState);
        }
    }
    /** firebase authorization event handler
     * @param { any } user logged in user - or null if not logged in
     */
    authHandleEvent(user) {
        return __awaiter(this, void 0, void 0, function* () {
            // ignore unwanted events
            if (user && this.uid === user.uid) {
                return;
            }
            if (user) {
                this.fireUser = user;
                this.uid = this.fireUser.uid;
                this.fireToken = yield user.getIdToken();
                document.body.classList.add("app_signed_in");
                document.body.classList.remove("app_signed_out");
                if (this.fireUser.isAnonymous)
                    document.body.classList.add("signed_in_anonymous");
                yield this._authInitProfile();
            }
            else {
                this.fireToken = null;
                this.fireUser = null;
                this.uid = null;
                document.body.classList.remove("app_signed_in");
                document.body.classList.add("app_signed_out");
                this.authUpdateStatusUI();
            }
            return;
        });
    }
    /** setup watch for user profile changes */
    _authInitProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.profileSubscription = firebase.firestore().doc(`Users/${this.uid}`)
                .onSnapshot((snapshot) => __awaiter(this, void 0, void 0, function* () {
                this.profileInited = true;
                this.profile = snapshot.data();
                if (!this.profile) {
                    if (this.fireUser.email) {
                        const result = yield firebase.auth().fetchSignInMethodsForEmail(this.fireUser.email);
                        // user was deleted dont create new profile - this is the case where the user deletes the account in browser
                        if (result.length < 1)
                            return;
                    }
                    yield this._authCreateDefaultProfile();
                }
                this.authUpdateStatusUI();
            }));
        });
    }
    /** create default user profile record and overwrite to database without merge (reset) */
    _authCreateDefaultProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.profile = {
                points: 0,
                locationTrack: false,
                favoriteBeer: null,
                favoriteStore: null,
                favoriteBrewery: null,
                excludeBeer: {},
                excludeStore: {},
                excludeBrewery: {},
                displayName: "",
                displayImage: "",
            };
            yield firebase.firestore().doc(`Users/${this.uid}`).set(this.profile);
        });
    }
    /** update user auth status, username/email etc */
    updateUserStatus() {
        return;
    }
    /** store user profile for nightmode
     * @param { any } ctl dom object
     * @param { number } index 0 = auto, 1 for day, 2 for nite
     * @param { any } e dom event object - preventDefault is called to stop anchor from navigating
     */
    updateProfileNightMode(ctl, index, e) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatePacket = {
                nightModeState: index,
            };
            this.updateNightModeStatus(index);
            if (this.fireToken)
                yield firebase.firestore().doc(`Users/${this.uid}`).update(updatePacket);
            if (e)
                e.preventDefault();
        });
    }
    /** paint night mode status change
     * @param { number } state 0 = auto, 1 for day, 2 for nite
     */
    updateNightModeStatus(state = 0) {
        let nite = false;
        if (state === 2)
            nite = true;
        if (state === 0) {
            if (new Date().getHours() < 8 || new Date().getHours() > 18)
                nite = true;
        }
        this.nightModeCurrent = nite;
        if (nite)
            document.body.classList.add("night_mode");
        else
            document.body.classList.remove("night_mode");
    }
    /** button handler for toggle night mode
     * @param { any } e dom event object
     * @return { boolean } true to stop anchor navigation
     */
    nightModeToggle(e) {
        let niteMode = 2;
        if (this.nightModeCurrent)
            niteMode = 1;
        this.updateNightModeStatus(niteMode);
        this.updateProfileNightMode(null, niteMode, null);
        e.preventDefault();
        return true;
    }
    /** store mute setting for user, mute any active sounds
     * @param { boolean } muted true if muted
     */
    updateMute(muted) {
        return __awaiter(this, void 0, void 0, function* () {
            this.muted = muted;
            if (!this.mute_button)
                return;
            if (muted) {
                this.mute_button.children[0].innerHTML = "volume_off";
                if (this.pickAudio)
                    this.pickAudio.pause();
                if (this.downAudio)
                    this.downAudio.pause();
                if (this.upAudio)
                    this.upAudio.pause();
                if (this.lockAudio)
                    this.lockAudio.pause();
                muted = true;
            }
            else {
                this.mute_button.children[0].innerHTML = "volume_up";
                muted = false;
            }
            if (this.profile) {
                yield firebase.firestore().doc(`Users/${this.uid}`).update({
                    muteState: muted,
                });
            }
        });
    }
    /** google sign in handler
     * @param { any } e dom event - preventDefault is called if passed
     */
    authGoogleSignIn(e) {
        return __awaiter(this, void 0, void 0, function* () {
            e.preventDefault();
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                "display": "popup",
            });
            yield firebase.auth().signInWithPopup(provider);
            setTimeout(() => {
                location.href = "/";
            }, 1);
        });
    }
    /** anonymous sign in handler
     * @param { any } e dom event - preventDefault is called if passed
     */
    signInAnon(e) {
        return __awaiter(this, void 0, void 0, function* () {
            e.preventDefault();
            yield firebase.auth().signInAnonymously();
            setTimeout(() => {
                location.href = "/";
            }, 1);
            return true;
        });
    }
    /** email sign in handler from UI (sends email to user for logging in)
     * @param { any } e dom event - preventDefault is called if passed
     */
    signInByEmail(e) {
        return __awaiter(this, void 0, void 0, function* () {
            e.preventDefault();
            let email = "";
            if (this.login_email)
                email = this.login_email.value;
            /*
            if (!email) {
              email = window.prompt("Please provide your email to send link");
            }*/
            if (!email) {
                alert("A valid email is required for sending a link");
                return;
            }
            const actionCodeSettings = {
                url: window.location.href,
                handleCodeInApp: true,
            };
            yield firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
            window.localStorage.setItem("emailForSignIn", email);
            alert("Email Sent");
        });
    }
    /** for use on page load - tests if a signIn token was included in the URL */
    signInWithURL() {
        if (!firebase.auth().isSignInWithEmailLink)
            return;
        if (firebase.auth().isSignInWithEmailLink(window.location.href) !== true)
            return;
        let email = window.localStorage.getItem("emailForSignIn");
        if (!email)
            email = window.prompt("Please provide your email for confirmation");
        firebase.auth().signInWithEmailLink(email, window.location.href)
            .then(() => {
            window.localStorage.removeItem("emailForSignIn");
            window.location = "/profile";
        })
            .catch((e) => console.log(e));
    }
    /** setup colors for tags */
    _generateColors() {
        this.tagList = Object.keys(window.beerTagsMap);
        this.tagList = this.tagList.sort();
        this.tagColorsArrays = [];
        this.tagList.forEach((tag) => {
            let color = [250, 190, 50];
            if (window.beerTagsMap[tag] === "bitter")
                color = [40, 240, 40];
            if (window.beerTagsMap[tag] === "distinct")
                color = [255, 0, 255];
            this.tagColorsArrays.push(color);
        });
        // r, g, b
        this.tagPens = [];
        this.tagColors = [];
        for (let c = 0; c < this.tagColorsArrays.length; c++) {
            const r = this.tagColorsArrays[c][0];
            const g = this.tagColorsArrays[c][1];
            const b = this.tagColorsArrays[c][2];
            this.tagColors.push(`rgb(${r}, ${g}, ${b})`);
            const fc = (r / 255 + (g / 255 * 1.5) + b / 255 > 1.4) ? "black" : "white";
            this.tagPens.push(fc);
        }
    }
    /** returns the extended name for a beer from the slug
     * @param { string } beer beerSlug
     * @param { number } option 0: (default) brewey beer 2: beer, brewery
     * @return { string } beer description
     */
    gameNameForBeer(beer, option = 0) {
        const beerData = this.allBeers[beer];
        if (!beerData)
            return "missing name";
        const name = beerData.name ? beerData.name : "Missing Name";
        const slugs = beer.split(":");
        const brewerySlug = slugs[0];
        const brewery = window.breweryJSON[brewerySlug];
        let bName = brewery.name;
        if (beerData.breweryName)
            bName = beerData.breweryName;
        return (option === 1) ? name + ", " + bName : bName + " " + name;
    }
    /** shuffles array order in place
     * @param { Array<any> } array array of any type
     * @return { Array<any> } passed in array returned in randomized order
     */
    _shuffleArray(array) {
        let currentIndex = array.length;
        while (0 !== currentIndex) {
            const randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex],
            ];
        }
        return array;
    }
    /** returns text value for time since Now, i.e. 3 mins ago
     * @param { Date } date value to format
     * @return { string } formatted string value for time since
     */
    timeSince(date) {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1)
            return Math.floor(interval) + ` year${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 2592000;
        if (interval > 1)
            return Math.floor(interval) + ` month${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 86400;
        if (interval > 1)
            return Math.floor(interval) + ` day${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 3600;
        if (interval > 1)
            return Math.floor(interval) + ` hour${Math.floor(interval) === 1 ? "" : "s"} ago`;
        interval = seconds / 60;
        if (interval > 1)
            return Math.floor(interval) + ` min${Math.floor(interval) === 1 ? "" : "s"} ago`;
        //  return Math.floor(seconds) + " seconds ago";
        return " just now";
    }
    /** convert isodate to local date as Date Object
     * @param { string } startTimeISOString iso date GMT referenced
     * @return { Date } JS Date object with date in local time zone reference
     */
    isoToLocal(startTimeISOString) {
        const startTime = new Date(startTimeISOString);
        const offset = startTime.getTimezoneOffset();
        return new Date(startTime.getTime() - (offset * 60000));
    }
    /** return mm/dd/yy for Date or String passed in
     * @param { any } d Date(d) is parsed
     * @return { string } mm/dd/yy string value
     */
    shortShowDate(d) {
        d = new Date(d);
        if (isNaN(d))
            return "";
        const str = d.toISOString().substr(0, 10);
        const mo = str.substr(5, 2);
        const ye = str.substr(2, 2);
        const da = str.substr(8, 2);
        return `${mo}/${da}/${ye}`;
    }
    /** mute click handler
     * @param { any } e dom event (preventDefault called if passed)
     * @return { boolean } true to cancel anchor navigation
     */
    muteClick(e) {
        this.muted = (!this.muted);
        this.updateMute(this.muted);
        e.preventDefault();
        return true;
    }
    /** calulate beer tag UI meta info
     * @param { string } beer beer slug (brewery:beer)
     * @return { any }
     */
    calcBeerTags(beer) {
        const data = window.beerTotals.beers[beer];
        if (!data) {
            return {};
        }
        const tags = data.sortedTags;
        let tagthreshold = data[tags[0]];
        for (let c = 1; c < 4; c++) {
            if (data[tags[c]] > tagthreshold)
                tagthreshold = data[tags[c]];
        }
        const levels = [];
        const backgroundColors = [];
        const colors = [];
        const returnTags = [];
        for (let c = 0; c < 4; c++) {
            levels.push(data[tags[c]] / tagthreshold);
            const index = this.tagList.indexOf(tags[c]);
            backgroundColors.push(this.tagColors[index]);
            colors.push(this.tagPens[index]);
            returnTags.push(tags[c]);
        }
        return {
            threshold: tagthreshold,
            levels,
            backgroundColors,
            colors,
            tags: returnTags,
        };
    }
}
export default BaseApp;
//# sourceMappingURL=baseapp.js.map