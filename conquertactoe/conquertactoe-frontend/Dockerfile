# Use an official Node.js runtime as a parent image
FROM node:22.5.1

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm config set legacy-peer-deps true
RUN npm install
RUN npm install --save-dev ajv@^8

# Copy the rest of the application code
COPY . .

# Build the React app with the environment variable
RUN npm run build

# Build the React app
RUN npm run build

# Install serve to serve the build folder
RUN npm install -g serve

# Set the command to run the app
CMD ["serve", "-s", "build"]

# Expose the port the app runs on
EXPOSE 5000
