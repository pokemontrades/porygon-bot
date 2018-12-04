# porygon-bot
An IRC bot created by the /r/pokemontrades team for our use.

## Features
* High Five
* .msg
* .checkball
* .checkfc
* Logging reported items from reddit
* Manipulating reddit toolbox usernotes
* Shortcuts

## Pre-requisites

* Node 6+ ([node installation instructions](https://nodejs.org/en/download/package-manager))
* NPM or Yarn ([yarn installation instructions](https://yarnpkg.com/en/docs/install))

Note: we recommend yarn due to it's improved caching and more reliable dependency installs, however npm should work just fine for the majority of people.

## Installation
* `yarn` or `npm install`
* `mv config.default.js config.js`
* edit config.js and update information
* If using database, add users into database

## Usage
* With Yarn:
```
yarn start
```
* With NPM:
```
npm start
```
