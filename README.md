# simplegame
Shared Firestore document to implement turn based games for matching cards and guessing phrases.
<br>
Transactional updates, chat, persistance updates and more.
<br><br>
If you want to upload custom user images enable the extension: <a href="https://extensions.dev/extensions/firebase/storage-resize-images" target="_blank">Resize Images</a><br>
<br>
Sizes of resized images: 200x200<br>
Cloud Storage path for resized images (Optional): _resized
<br><br>
After creating the Firestore instance, convert it to "Native" in the google cloud console and wait a couple minutes to deploy
<br>
It will create a file at <userstorage>/_resized/pimage_200x200 (refer to profileapp.js for more)
<br><br>

If you create firestore indexes on the server<br>
 PS> firebase firestore:indexes | out-file -encoding utf8 "firestore.indexes.json"
 <br><br>
Hosted<br>
<a href="https://sharedgamelobby.web.app/" target="_blank">sharedgamelobby.web.app</a>
<br>
<br>
* changing code<br><br>
Editing the typescript for the browser -<br>
Directory: public/uicode<br>
Command: tsc --watch <br>
<br>
Editing the typescript for the cloud functions -<br>
Directory: public/src<br>
Command: tsc --watch<br>
<br>
To deploy - compiles the functions - but NOT the browser code<br>
Directory: project\<br>
Command: firebase deploy<br>
<br>
