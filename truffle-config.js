module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 9545,      // match Ganache GUI
      network_id: "*", // or 5777 if you want exact
    },
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: { optimizer: { enabled: true, runs: 200 } }
    }
  }
};
