# 1. Stop all running containers
echo "🛑 Stopping all containers..."
docker stop $(docker ps -aq)

# 2. Remove all containers
echo "🗑️ Removing all containers..."
docker rm $(docker ps -aq)

# 3. Remove ALL Docker volumes (This deletes the Databases)
echo "🔥 Wiping all database data..."
docker volume rm $(docker volume ls -q)

# 4. Remove the network
echo "🌐 Removing network..."
docker network rm conquer-network

# 5. Final Cleanup of images/cache
echo "🧹 Pruning system..."
docker system prune -a -f --volumes