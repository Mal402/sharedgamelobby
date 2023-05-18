# simplegame
Shared Firestore document to implement turn based games for matching cards and guessing phrases.
<br>
Transactional updates, chat, persistance updates and more.
<br><br>
Enabled the extension: <a href="https://extensions.dev/extensions/firebase/storage-resize-images" target="_blank">Resize Images</a><br>
Set the target directory to _resized, and create a 70x70 if you upload custom user images
<br>
It will create a file at <userstorage>/_resized/pimage_70x70 (refer to profileapp.js for more)
<br><br>

If you create firestore indexes on the server<br>
 PS> firebase firestore:indexes | out-file -encoding utf8 "firestore.indexes.json"
 <br><br>
