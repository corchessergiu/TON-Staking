require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      forking: {
        url: "https://public.stackup.sh/api/v1/node/ethereum-mainnet",
      },
    }
  }
};
