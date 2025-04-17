* Follow the steps below to install and use Node.js version 18.20.3 using nvm:
	- Install nvm:
		curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

	- Set up nvm environment:
		export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

	-Verify nvm Installation:
		command -v nvm

	- Install Node.js Version 18.20.3:
		nvm install 18.20.3

	- Set the installed Node.js version as active:
		nvm use 18.20.3

	npm install -> Will install all dependencies -> takes 10 to 15 min

	=========================
	localhost:5500/index.html
	=========================

	node parser.js
