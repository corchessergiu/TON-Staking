const { ethers } = require("hardhat");
const { WETH9ABI } = require("../abis/WETH.json");
const { SwapRouterV2ABI } = require("../abis/SwaoRouter.json");
const { WTONABI } = require("../abis/WTON.json");
const { TONABI } = require("../abis/TON.json");
const { DepositManagerABI } = require("../abis/DepositManager.json");
const { SeigManagerABI } = require("../abis/SeigManager.json");
const { CoinAgeABI } = require("../abis/CoinAge.json");
const {
  RefactorCoinageSnapshotABI,
} = require("../abis/RefactorCoinageSnapshotI.json");
const web3 = require("web3");

function marshalString(str) {
  if (str.slice(0, 2) === "0x") return str;
  return "0x".concat(str);
}

function unmarshalString(str) {
  if (str.slice(0, 2) === "0x") return str.slice(2);
  return str;
}

const DEFAULT_PAD_LENGTH = 2 * 32;

function padLeft(str, padLength = DEFAULT_PAD_LENGTH) {
  const v = web3.utils.toHex(str);
  return marshalString(web3.utils.padLeft(unmarshalString(v), padLength));
}

async function stakingInteraction() {
  const [deployer] = await ethers.getSigners();
  const WETH9MainnetAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const WTONMainnetAddress = "0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2";
  const SwapRouterV2Address = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
  const TONMainnetAddress = "0x2be5e8c109e2197D077D13A82dAead6a9b3433C5";
  const deployerAddress = await deployer.getAddress();

  const WETH = await ethers.getContractAt(WETH9ABI, WETH9MainnetAddress);
  const SwapRouterV2 = await ethers.getContractAt(
    SwapRouterV2ABI,
    SwapRouterV2Address
  );
  const WTON = await ethers.getContractAt(WTONABI, WTONMainnetAddress);
  const amountInWei = ethers.utils.parseEther("10");
  const TON = await ethers.getContractAt(TONABI, TONMainnetAddress);

  console.log("===============Convert ETH to WETH===============");
  console.log(
    "Balance of WETH before converting: ",
    Number(await WETH.balanceOf(deployerAddress))
  );
  //Convert ETH to WETH
  const tx = await WETH.deposit({ value: amountInWei });
  await tx.wait();
  console.log(
    "Balance of WETH after converting: ",
    ethers.utils.formatUnits(await WETH.balanceOf(deployerAddress))
  );

  console.log();
  console.log("===============Check allowance for swapRouter===============");
  console.log(
    "Initial allowance for swapRouter contract: ",
    Number(await WETH.allowance(deployerAddress, SwapRouterV2Address))
  );
  const txApprove = await WETH.approve(SwapRouterV2Address, amountInWei);
  await txApprove.wait();
  console.log(
    "SwapRouter allowance after approve: ",
    ethers.utils.formatEther(
      (await WETH.allowance(deployerAddress, SwapRouterV2Address)).toString()
    )
  );
  console.log();

  console.log("===============Swap WETH TO WTON===============");
  let balanceWTONBeforeSwap = await WTON.balanceOf(deployerAddress);
  console.log(
    "WTON balance before swap: ",
    ethers.utils.formatUnits(balanceWTONBeforeSwap, 27)
  );
  const params = {
    tokenIn: WETH9MainnetAddress,
    tokenOut: WTONMainnetAddress,
    fee: 3000,
    recipient: deployerAddress,
    amountIn: amountInWei,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  try {
    const tx = await SwapRouterV2.exactInputSingle(params);
    await tx.wait();
  } catch (error) {
    console.error(error);
  }
  let balanceWTONAfterSwap = await WTON.balanceOf(deployerAddress);
  console.log(
    "WTON balance for deployer after swap: ",
    ethers.utils.formatUnits(balanceWTONAfterSwap, 27)
  );
  console.log();

  console.log("===============SWAP WTON FOR TON===============");
  console.log(
    "TON balance before swap ",
    ethers.utils.formatUnits(await TON.balanceOf(deployerAddress), "ether")
  );

  //SWAP 20 WTO FOR 20 TON IN RAY FORMAT!
  await WTON.swapToTON("200000000000000000000000000000");
  console.log(
    "TON balance after swap ",
    ethers.utils.formatUnits(await TON.balanceOf(deployerAddress), "ether")
  );
  console.log();

  const depositManagerAddress = "0x0b58ca72b12f01fc05f8f252e226f3e2089bd00e";
  const Tokamak1Layer2Address = "0x36101b31e74c5E8f9a9cec378407Bbb776287761";
  const DepositManager = await ethers.getContractAt(
    DepositManagerABI,
    depositManagerAddress
  );

  console.log(
    "===============Check total supply before increase number of blocks==============="
  );
  let totalWTONSupply = ethers.utils.formatUnits(await WTON.totalSupply(), 27);
  console.log("Total WTON supply: ", totalWTONSupply);

  let totalTONSupply = ethers.utils.formatUnits(
    await TON.totalSupply(),
    "ether"
  );
  console.log("Total TON supply: ", totalTONSupply);

  //Build data field, 2 addresses: depositManagerAddress and Tokamak1Layer2Address
  let firstDataPart = padLeft(unmarshalString(depositManagerAddress), 64);
  let secondPart = unmarshalString(
    padLeft(unmarshalString(Tokamak1Layer2Address), 64)
  );
  const data = firstDataPart + secondPart;
  const amountInWeiForApproveAndCall = ethers.utils.parseEther("100");
  console.log(
    "===============Deposit Manager contract data before call approveAndCall==============="
  );
  console.log(
    "AccStakedAccount balance before deposit in Manager contract: ",
    ethers.utils.formatUnits(
      await DepositManager.accStakedAccount(deployerAddress),
      27
    )
  );
  console.log(
    "Total WTON stake by user on Layer2 before deposit: ",
    ethers.utils.formatUnits(
      await DepositManager.accStaked(Tokamak1Layer2Address, deployerAddress),
      27
    )
  );
  console.log();
  console.log(
    "===============CALL approveAndCall FROM TON for 100 tokens==============="
  );
  await TON.approveAndCall(
    WTONMainnetAddress,
    amountInWeiForApproveAndCall,
    data
  );
  console.log();
  console.log(
    "AccStakedAccount balance after deposit in Manager contract: ",
    ethers.utils.formatUnits(
      await DepositManager.accStakedAccount(deployerAddress),
      27
    )
  );
  console.log(
    "Total WTON stake by user on Layer2 after deposit: ",
    ethers.utils.formatUnits(
      await DepositManager.accStaked(Tokamak1Layer2Address, deployerAddress),
      27
    )
  );

  console.log("===============Check data from CoinAge contract===============");
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );

  const coinageAddress = await SeigManager.coinages(Tokamak1Layer2Address);
  const CoinAge = await ethers.getContractAt(CoinAgeABI, coinageAddress);
  const coinageBalance = await CoinAge.balanceOf(deployer.address);
  console.log(
    "User WTON balance after deposit:",
    ethers.utils.formatUnits(coinageBalance, 27)
  );

  const newTONBalance = await TON.balanceOf(deployer.address);
  console.log(
    "User TON balance in wallet after deposit:",
    ethers.utils.formatUnits(newTONBalance, "ether")
  );
  console.log();
  console.log("===============_increaseTot() function================");
  console.log();
  let seigPerBlock = ethers.BigNumber.from(await SeigManager.seigPerBlock());
  console.log("Seig per block ", ethers.utils.formatUnits(seigPerBlock,27));
  let _ton = await SeigManager.ton();
  let prevTotSupply = ethers.BigNumber.from(await SeigManager.stakeOfTotal());
  let blockNumber = await ethers.provider.getBlockNumber();
  let lastSeigBlock = await SeigManager.lastSeigBlock();
  let unpausedBlock = await SeigManager.unpausedBlock();
  let pausedBlock = await SeigManager.pausedBlock();
  let span = blockNumber - lastSeigBlock;
  let calcSeigBlock;
  if (unpausedBlock < lastSeigBlock) {
    calcSeigBlock = span;
  } else {
    calcSeigBlock = span - (unpausedBlock - pausedBlock);
  }
  let maxSeig = ethers.BigNumber.from(calcSeigBlock).mul(seigPerBlock);
  console.log("MAX SEIG ", ethers.utils.formatUnits(maxSeig,27));

  //calculate tos
  let tonTotalSupply = ethers.BigNumber.from(await TON.totalSupply());
  let wtonBalance = ethers.BigNumber.from(
    await TON.balanceOf(WTONMainnetAddress)
  );
  let address0Balance = ethers.BigNumber.from(
    await TON.balanceOf("0x0000000000000000000000000000000000000000")
  );
  let address1Balance = ethers.BigNumber.from(
    await TON.balanceOf("0x0000000000000000000000000000000000000001")
  );
  let refactorAddress = await SeigManager.tot();

  const refactorContract = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    refactorAddress
  );
  let refactorBalance = ethers.BigNumber.from(
    await refactorContract.totalSupply()
  );
  let tos = tonTotalSupply
    .sub(wtonBalance)
    .sub(address0Balance)
    .sub(address1Balance)
    .mul(1000000000)
    .add(refactorBalance);
  console.log("tos supply ", ethers.utils.formatUnits(tos, 27));
  let _totTotSupply = await SeigManager.stakeOfTotal();
  let stakedSeig = maxSeig.mul(_totTotSupply).div(tos);
  console.log("stakedSeig ", ethers.utils.formatUnits(stakedSeig, 27));
  let relativeSeigRate = ethers.BigNumber.from(
    await SeigManager.relativeSeigRate()
  );
  console.log("relativeSeigRate, ", ethers.utils.formatUnits(relativeSeigRate,27));
  let totalPseig = maxSeig.sub(stakedSeig).mul(relativeSeigRate);
  console.log("totalPseig ", ethers.utils.formatUnits(totalPseig, 54));
  let nextTotalSupply = prevTotSupply.add(stakedSeig).add(totalPseig);
  console.log(
    "DEPOSIT MANAGER BALANCE ",
    ethers.utils.formatUnits(
      (await WTON.balanceOf(depositManagerAddress)).toString(),
      27
    )
  );

  //back to update Signorige
  let coinAgeAddress = await SeigManager.coinages(Tokamak1Layer2Address);
  const refactorContractUpdateSeignioarege = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    coinAgeAddress
  );
  let preTotalSupplyUpdateFunction = ethers.BigNumber.from(
    await refactorContractUpdateSeignioarege.totalSupply()
  );
  console.log(
    "preTotalSupplyUpdateFunction ",
    ethers.utils.formatUnits(preTotalSupplyUpdateFunction, 27)
  );

  let _totAddress = await SeigManager.tot();
  console.log("_totAddress ", _totAddress);
  const refactorContractUpdateSeignioaregeTotToken = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    _totAddress
  );
  console.log("balance for  Tokamak1Layer2Address:", Tokamak1Layer2Address);
  let nextTotalSupplyUpdateFunction = ethers.BigNumber.from(
    await refactorContractUpdateSeignioaregeTotToken.balanceOf(
      Tokamak1Layer2Address
    )
  );
  console.log(
    "nextTotalSupplyUpdateFunction ",
    ethers.utils.formatUnits(nextTotalSupplyUpdateFunction, 27)
  );
  let seig = ethers.utils.formatUnits(
    nextTotalSupplyUpdateFunction.sub(preTotalSupplyUpdateFunction).toString(),
    27
  );
  console.log("Seig result ", seig);
  console.log()
  console.log("===============Update Seigniorage===============");
  //Impersonate the Layer2 address for update the seigniorage
  await ethers.provider.send("hardhat_impersonateAccount", [
    Tokamak1Layer2Address,
  ]);
  const signerForLayer2 = await ethers.getSigner(Tokamak1Layer2Address);
  console.log(
    "DEPOSIT MANAGER BALANCE BEFORE MINE BLOCKS UPDATE",
    ethers.utils.formatUnits(
      (await WTON.balanceOf(depositManagerAddress)).toString(),
      27
    )
  );
  await ethers.provider.send("hardhat_mine", ["0x989680"]); //10.000.000 blocks
  console.log(
    "DEPOSIT MANAGER BALANCE AFTER MINE BLOCKS UPDATE",
    ethers.utils.formatUnits(
      (await WTON.balanceOf(depositManagerAddress)).toString(),
      27
    )
  );
  const ethToSet = ethers.utils.parseEther("1.0");
  await ethers.provider.send("hardhat_setBalance", [
    Tokamak1Layer2Address,
    ethToSet.toHexString(),
  ]);

  const updateTX = await SeigManager.connect(
    signerForLayer2
  ).updateSeigniorage();
  await updateTX.wait();

  console.log(
    "DEPOSIT MANAGER BALANCE AFTER UPDATE",
    ethers.utils.formatUnits(
      (await WTON.balanceOf(depositManagerAddress)).toString(),
      27
    )
  );

  const balanceAfterUpdate = await CoinAge.balanceOf(deployer.address);
  console.log(
    "User WTON balance after updateSeigniorage:",
    ethers.utils.formatUnits(balanceAfterUpdate, 27)
  );
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [
    Tokamak1Layer2Address,
  ]);
  console.log();

  let totalWTONSupplyAfterMine = ethers.utils.formatUnits(
    await WTON.totalSupply(),
    27
  );
  console.log("Total WTON supply after mine: ", totalWTONSupplyAfterMine);

  let totalTONSupplyAfterMine = ethers.utils.formatUnits(
    await TON.totalSupply(),
    "ether"
  );
  console.log("Total TON supply after mine: ", totalTONSupplyAfterMine);

  let prevTotSupplyAfterUpdate = await SeigManager.stakeOfTotal();
  console.log(
    "prevTotSupplyAfterUpdate: ",
    ethers.utils.formatUnits(prevTotSupplyAfterUpdate, 27)
  );

  let afterUpdateSeigniorageTotalSupply = ethers.BigNumber.from(
    await refactorContractUpdateSeignioarege.totalSupply()
  );
  console.log(
    "afterUpdateSeigniorageTotalSupply ",
    ethers.utils.formatUnits(afterUpdateSeigniorageTotalSupply, 27)
  );

  console.log("===============Withdraw request===============");

  //Request to withdraw 10 tokens
  const rwTx = await DepositManager.requestWithdrawal(
    Tokamak1Layer2Address,
    "10000000000000000000000000000"
  );
  await rwTx.wait();

  const walletWTONAmountBeforeWithdraw = await WTON.balanceOf(deployer.address);
  console.log(
    "User WTON balance in wallet before processing withdrawal:",
    ethers.utils.formatUnits(walletWTONAmountBeforeWithdraw, 27)
  );
  //Cover DTD
  await ethers.provider.send("hardhat_mine", ["0x989680"]);
  const prTx = await DepositManager.processRequest(
    Tokamak1Layer2Address,
    false
  );
  await prTx.wait();

  const finalWtonBalance = await WTON.balanceOf(deployer.address);
  console.log(
    "User WTON balance in wallet after processing withdrawal:",
    ethers.utils.formatUnits(finalWtonBalance, 27)
  );
  console.log();
}

stakingInteraction();
