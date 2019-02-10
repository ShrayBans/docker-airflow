function getRandomInterval(min, range) {
    return Math.floor(Math.random() * (range || 10000)) + (min || 12000);
}

module.exports = {
    getRandomInterval,
}