# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose port (default 3000, adjust if needed)
EXPOSE 5050

# Start the application
CMD ["node", "server.js"]
