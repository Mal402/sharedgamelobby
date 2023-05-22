<h1>Shared Game Lobby </h1>


Welcome to the Shared Game Lobby repo! This project showcases a game lobby with a shared state, allowing users to create and join games in a collaborative environment. It provides an immersive and dynamic gaming experience, enabling multiple users to interact and contribute to the game lobby in real-time similar to the collaborative nature of Google Docs. Powered by Firebase, Transactions, REST API, and Real-time Feeds with NoSQL Indexing, this app ensures a seamless and interactive gaming experience for all participants.

Hosted: [sharedgamelobby.web.app](https://sharedgamelobby.web.app/) \


**Features**



* **User Authentication**: create accounts and log in anonymously or with Google accounts.
* **Game Creation:** create new games with customizable options, including game type, visibility, number of seats, and message level.
* **Game Joining:** join existing games in the lobby, subject to player limitations set by the game creator..
* **User Profiles:** customize user profiles with preferences such as audio mode and night mode.
* **Game Message Feed: **communicate and exchange messages related to the game through a dedicated message feed.
* **Real-time User Status Updates**:  track user activity and engagement in the game lobby with presence indicators

**Real-time Data Updates**




Real-time updates play a crucial role in creating an immersive gaming experience. The Shared Game Lobby leverages Firebase's real-time database to provide instantaneous updates whenever a user performs an action, such as sitting, standing, deleting, or sending messages. With the help of Firebase's real-time synchronization capabilities, users can see live updates reflected in the lobby, ensuring a seamless and engaging gameplay environment.

**Transactions and Data Consistency**

Transactions are used extensively in the Shared Game Lobby to ensure data consistency and accuracy, especially in situations where multiple users attempt to perform actions concurrently. By encapsulating critical operations within transactions, the lobby handles contested actions such as sitting contests or turn-based interactions with precision and reliability. This guarantees that critical game elements, such as inventory transactions or financial operations, are executed accurately and in a controlled manner. \
 \


**REST API for Seamless Integration**

The Shared Game Lobby leverages NoSQL indexing techniques to efficiently manage real-time feeds and game listings. By utilizing a deep path structure in the database, the lobby ensures efficient indexing and retrieval of game-related information. For example, when a user performs the 'sit' action to join a game, the lobby leverages the following technique:



This code snippet demonstrates how the lobby communicates with the backend using a RESTful API endpoint to perform the 'sit' action. The endpoint, /webPage/games/sit, handles the request and updates the corresponding game data on the Firesbase Database document, allowing the user to join the game. The use of Firebase authentication ensures secure access to the API endpoint, while the response provides feedback on the success of the action.

This technique enables the lobby to maintain a consistent and up-to-date game state, allowing users to seamlessly join games and interact with real-time data updates.

<h1>Implementation Details and Components</h1>


To seamlessly integrate the game lobby into your application and leverage its powerful features, it's important to understand the backend and client-side implementation. We'll explore the backend files (index.ts, gameapi.ts, and guessapi.ts) responsible for server-side operations and Firebase Realtime Database interactions. On the client side, we will look at baseapp.js and gamebaseapp.js scripts which are responsible for facilitating user interactions and UI. Firestore database documents store crucial user and game information, ensuring a seamless and synchronized experience for all participants. Let's dive into each component's details and explore their implementation aspects.

<h2>Backend Severside</h2>


To ensure the smooth functioning of the shared game lobby and real-time updates, it is important to understand how the backend and frontend work together to update the Firebase database documents. The backend code consists of several key files and endpoints that handle game-related actions and interactions. 

<h3>**‘index.ts’**</h3>


The** index.ts** file serves as the entry point for the backend code. It sets up the necessary configurations, initializes Firebase, and defines the endpoints and functions associated with the game lobby. In the index.ts file, two important components are the onWrite and post methods. Let's explain each of them:

**onWrite **method:



* This method is used as a Firestore trigger to execute a function whenever a document in the "Users" collection is written.
* The function specified in the **onWrite **method is called with two parameters: **change **and **context**.
* **change **represents the change in the document that triggered the function.
* **context **provides information about the context in which the function was triggered, such as the document ID or user ID.
* In the code snippet, the onWrite method is used to call the updateUserMetaData function from the GameAPI module whenever a document in the "Users" collection is written.

**post **method:



* This method defines the HTTP POST endpoints for the game lobby API.
* Each endpoint is associated with a specific URL path and an asynchronous function that handles the corresponding request and response.
* In the code snippet, various game-related endpoints such as** /games/create**, **/games/join**, **/games/leave**, etc., are defined.
* Each endpoint corresponds to a function from the **GameAPI **module that performs the necessary operations for that specific game action.
* For example, when a POST request is made to the **/games/create** endpoint, the create function from the GameAPI module is called with the **req **(request) and **res **(response) objects to handle the creation of a new game.

These methods allow the backend code to respond to specific triggers and handle API requests from the frontend, ensuring the seamless operation of the shared game lobby.

<h3>**‘gameapi.ts’**</h3>


The **gameapi.ts** file contains the implementation of various endpoints for handling game-related actions and interactions. It provides a RESTful API for creating, joining, leaving, and managing games in the shared game lobby.



* **create**(req, res): This endpoint handles the creation of a new game. It receives the necessary parameters from the request (req) and sends the appropriate response (res) back to the clien**t.**
* **join**(req, res): This endpoint allows users to join an existing game. It receives the request with the game ID and user information and processes the join operation accordingly.
* **leave**(req, res): Users can use this endpoint to leave a game. It handles the removal of the user from the game and updates the game state accordingly.
* **sit**(req, res): This endpoint handles the action of a user sitting in a specific seat in the game. It receives the seat information from the request and updates the game state accordingly.
* **stand**(req, res): Users can use this endpoint to stand up from their current seat in the game. It removes the user from the seat and updates the game state.
* **delete**(req, res): This endpoint allows the deletion of a game. It receives the game ID from the request and deletes the game from the system.
* **options**(req, res): This endpoint handles the modification of game options, such as visibility, number of seats, and message level. It receives the updated options from the request and updates the game state accordingly.
* **message**(req, res): Users can use this endpoint to send a message related to the game. It receives the message content from the request and adds it to the game's message feed.
* **messageDelete**(req, res): This endpoint handles the deletion of a specific message from the game's message feed. It receives the message ID from the request and removes the message from the game's message feed.

<h3>**‘guessapi.ts’**</h3>


The **guessapi.ts** file contains the backend code for the game logic related to the Guess games, including starting and ending the game, updating scores, processing user actions, and handling the spinning of the wheel.  Here is a brief overview of the functions and their purpose::



* **userAction**(): HTTP endpoint for handling user actions in the game, such as starting the game, ending the game, resetting the game, spinning the wheel, or playing a turn.
* **getMainData**(): Retrieves compiled beer data from an external source.
* **gameNameForBeer**(): Generates a full beer name based on the brewery and beer data.
* **_updatePoints**(): Updates the score in the storage object based on user actions and the selected letter.
* **_calculateWheelAdvance**(): Calculates the ending position in radians to spin the wheel based on the game data.
* **_processGuessAction**(): Processes the user's guess action and returns a delta packet to apply to the storage object.

Additionally, our application includes another game mode called 'Match' which operates on a similar technique level as 'Guess.' The implementation details and components for 'Match' are highly analogous to those of 'Guess,' and can be explored further in the source code. 

<h2>Frontend Clientside</h2>


Building upon the backend implementation, the frontend code plays a crucial role in ensuring real-time updates and a synchronized experience for users. The baseapp.js and gamebaseapp.js models serve as the backbone of the game lobby, handling data loading, user authentication, and online presence management. Furthermore, we'll explore how the Firebase Realtime Database enables real-time user status updates, enhancing the interactive nature of the game lobby. Let's delve into the frontend code and discover how it collaborates with the backend to create a dynamic and engaging gaming environment.

<h3>**‘baseapp.ts’**</h3>


The baseapp.js model provides the basic functionality and event handling for the game lobby application. It sets up event listeners, loads data, handles user authentication, and manages user profiles.



* **load**(): This method loads data from JSON files using fetch and Promise.all. It fetches data such as brewery map, beer map, beer tags, trending data, store map, and beer totals.
* **authHandleEvent**(): This method is called when the authentication state changes. It updates the UI based on the user's authentication status.
* **signInAnon**(), **signInByEmail**(), **signInWithURL**(): These methods handle different sign-in methods, allowing users to create accounts and log in using various authentication methods. \


<h3>**‘gamebaseapp.ts’**</h3>




* The **gamebaseapp.ts** model extends the functionality of **baseapp.ts** and provides additional features and event handling specific to the game lobby.
* **refreshOnlinePresence**(): This method updates the user's online presence status in the Firebase Realtime Database.
* **initRTDBPresence**(): This method initializes the presence feature in the Firebase Realtime Database for the current user.
* **addUserPresenceWatch**(): This method adds a presence watch for a specific user, updating the userPresenceStatus object.
* **updateUserPresence**(): This method updates the UI to reflect the online presence status of users.
* **gameTypeMetaData**(): This method returns an object containing metadata for different game types.
* **initGameMessageFeed**(): This method initializes the game message feed and listens for new messages.
* **updateGameMessagesFeed**(): This method updates the game message feed UI with new messages.
* **deleteMessage**(): This method deletes a game message.

We have omitted the detailed explanation of the 'guessapp.ts' and 'matchapp.ts' client-side files from this documentation as they are game specific. These files can be explored directly within the application's source code for further understanding. 

<h2>A note on achieving Real-Time User Status Updates with Firebase Realtime Database </h2>


 \


 gamebaseapp.js

This code snippet enables real-time updates of user status using **Firebase Realtime Database** (RTDB). It ensures that the user's online status is accurately reflected, even when they disconnect abruptly or use multiple browsers or tabs.

To refresh the user's online presence, call the **refreshOnlinePresence**() function. It sets the user's status to "online" in the RTDB and updates the timestamp.

To initialize RTDB presence status, use the **initRTDBPresence**() function. It creates a reference to the user's presence status and sets up offline and online status objects.

The code optimizes computational resources by leveraging the **onDisconnect**() event handler. It automatically updates the user's status to "offline" in the RTDB when the client disconnects, eliminating the need for frequent client-server communication.

Multiple browsers or tabs are handled gracefully. The **onDisconnect**() event ensures that the user is marked as "offline" only when all browsers are closed or disconnected, avoiding false reports of offline status.

The **addUserPresenceWatch**(uid) function allows monitoring of online status for a specific user. It listens for changes in the user's presence status and updates the UI accordingly.

The **updateUserPresence**() function updates the UI elements based on the user's online status. It adds the "online" class to elements representing online users and removes it for offline users. Additionally, it updates the document.body class to indicate online users in specific seats.

<h2>Firestore Database Users & Games Documenst:</h2>


By structuring game and user information in Firestore documents, it provides a scalable and efficient approach to store and retrieve data, ensuring a seamless and personalized experience for the users within the game environment. 





Guess Collection, Games Document on Firebase

Once you are up and running, go through the Firebase and look at through the collections and documents to see all data fields. The following are reasons why we decided to do it the way we did it. 

**Data Consistency:** By storing all the game-related information within a single document, it ensures data consistency. All the game state, player details, configuration, and other relevant information are stored together, eliminating the need to retrieve data from multiple locations and ensuring that all game-related data is up to date and synchronized.

**Efficient Retrieval:** Storing all the game information in a single document allows for efficient retrieval of data. When a game is loaded or updated, the application can fetch the entire document in a single database read operation. This reduces the number of database requests and enhances performance.

**Real-time Updates: **Firestore provides real-time synchronization, enabling seamless updates to the game state. Any changes made to the game document will automatically trigger updates in real-time for all connected clients. This allows all players to have an up-to-date view of the game and experience real-time changes without delay.

**One-at-a-time:** Firestore ensures atomicity (“one at a time”) at the document level, meaning that simultaneous updates to the game document by multiple players are handled seamlessly. This guarantees reliable and consistent game updates, eliminating conflicts or inconsistent states.

<h3>Users</h3>







Users Collection on Firebase

**User Profile:** The user document contains all the relevant information about a user's profile, such as display name, profile image URL, mute state, and night mode state. Storing this information in a user document allows for easy retrieval and presentation of user-specific details throughout the application.

**Personalized Experience:** By storing user-specific preferences, such as mute state and night mode state, in the user document, the application can provide a personalized experience tailored to each user. These preferences can be easily accessed and applied to customize the user interface or game behavior based on individual preferences.

**Efficient Updates:** Storing user information in a single document allows for efficient updates and retrieval. When a user updates their profile or preferences, the application can perform a single database write operation to update the user document, ensuring that the changes are immediately reflected across the application.

**Integration with Game Document: **The user document often includes references or IDs related to the games the user is associated with, such as game IDs or membership details. This integration allows for efficient cross-referencing between user profiles and game documents, enabling features like retrieving a user's active games or displaying user-specific information within a game session.

<h3>Getting Started</h3>


To begin using the Shared Game Lobby project, please follow the steps outlined below:

**Installation Guide:**



1. Clone the project repository from the designated location.
2. Install the necessary dependencies by running the appropriate package manager command (e.g., npm install or yarn install).
3. Set up the required environment variables, if any, following the instructions provided in the installation guide.
4. Ensure that you have the latest version of Node.js and npm (Node Package Manager) installed on your machine.
5. Build the project by running the build command (e.g., npm run build or yarn build) to generate the production-ready assets.

**Configuration Guide:**



1. Create a Firebase project by visiting the Firebase Console (https://console.firebase.google.com/) and following the provided instructions.
2. Configure the Firebase integration by updating the necessary configuration files with your Firebase project credentials, such as the API key, project ID, and other relevant details.
3. If required, configure the REST API settings by specifying the desired endpoints, authentication methods, and access control rules.
4. To set up a local instance, follow these additional steps:
    1. Open the baseclass.ts file, which contains the source code for setting up the local instances.
    2.  Ensure that you have the firebase-admin package installed.
    3.  Instantiate a new LocalInstance and initialize the configuration data using the init() method.
    4.  Customize the local instance according to your requirements, such as adding additional configuration data or modifying the validation logic.

If you want to upload **custom user images** enable the extension: [Resize Images](https://extensions.dev/extensions/firebase/storage-resize-images)



* Sizes of resized images: 200x200
* Cloud Storage path for resized images (Optional): _resized
* After creating the Firestore instance, convert it to "Native" in the google cloud console and wait a couple minutes to deploy
* It will create a file at /_resized/pimage_200x200 (refer to profileapp.js for more)

**Usage Guide:**



1. Launch the application by running the appropriate command (e.g., npm start or yarn start) to start the development server.
2. Access the application through the provided URL or by opening a web browser and navigating to the designated address.
3. Explore the user interface and familiarize yourself with the available features, such as creating games, joining games, managing game options, sending messages, and more.
4. Refer to the usage guide for detailed instructions, examples, and best practices on how to interact with the lobby, perform essential actions, and make the most out of the shared game experience.

**For More Information:**

For more in-depth information and documentation regarding Firebase integration, transactions, REST API usage, and real-time feeds with NoSQL indexing, please refer to the official Firebase documentation (https://firebase.google.com/docs) and the relevant documentation provided within the project's codebase.

We hope this guide helps you get started with the Shared Game Lobby project successfully. Enjoy the collaborative gaming experience empowered by Firebase and the extensive features of the project. 

**Contact:**

We appreciate your interest in the Shared Game Lobby project! If you encounter any bugs, have feedback to share, or would like to make suggestions for improvement, we encourage you to reach out to us. We will do our best to assist you with issues you may encounter, but please note we may not always have time to do so promptly.

**Bug Reports, Feedback, and Suggestions:**

If you encounter any bugs while using the Shared Game Lobby or have feedback to provide, please don't hesitate to reach out to us. Additionally, if you have suggestions for enhancements or new features that you believe would benefit the project, we encourage you to share them with us.

To submit bug reports, provide feedback, or make suggestions, please visit the project's GitHub Issues page:

GitHub Issues: [https://github.com/HuskerSam/sharedgamelobby/issues](https://github.com/HuskerSam/sharedgamelobby/issues)

**Donation:**

If you find the Shared Game Lobby project useful and would like to support its ongoing development and maintenance, you can contribute by making a donation. To make a donation, please visit our donation page at XXXXXXXXXXXXXXXXX

We appreciate detailed bug reports, specific feedback, and well-articulated suggestions. Your contributions help us identify and address issues promptly and enhance the overall experience for all users.
