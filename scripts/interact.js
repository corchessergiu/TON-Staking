const { ethers } = require("hardhat");
const { WETH9ABI } = require("../abis/WETH.json");
const { SwapRouterV2ABI } = require("../abis/SwapRouter.json");
const { WTONABI } = require("../abis/WTON.json");
const { TONABI } = require("../abis/TON.json");
const { DepositManagerABI } = require("../abis/DepositManager.json");
const { SeigManagerABI } = require("../abis/SeigManager.json");
const { CoinAgeABI } = require("../abis/CoinAge.json");
const {
  RefactorCoinageSnapshotABI,
} = require("../abis/RefactorCoinageSnapshotI.json");
const { Layer2IABI } = require("../abis/Layer2I.json");

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
  console.log(
    "Block number before approve and call : ",
    await ethers.provider.getBlockNumber()
  );
  await TON.approveAndCall(
    WTONMainnetAddress,
    amountInWeiForApproveAndCall,
    data
  );
  console.log(
    "Block number after approve and call: ",
    await ethers.provider.getBlockNumber()
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
  //await ethers.provider.send("hardhat_mine", ["0x989680"]);
  //updateSeigniorage();
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
  console.log("User TON balance in wallet after deposit:", ethers.utils.formatUnits(newTONBalance, "ether"));
  console.log()

  //back to update Signorige
  let coinAgeAddress = await SeigManager.coinages(Tokamak1Layer2Address);
  const refactorContractUpdateSeignioarege = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    coinAgeAddress
  );


  console.log("===============Update Seigniorage===============");
  //Impersonate the Layer2 address for update the seigniorage
  await ethers.provider.send("hardhat_impersonateAccount", [Tokamak1Layer2Address]);
  const signerForLayer2= await ethers.getSigner(Tokamak1Layer2Address);
  console.log("DEPOSIT MANAGER BALANCE BEFORE MINE BLOCKS UPDATE",ethers.utils.formatUnits((await WTON.balanceOf(depositManagerAddress)).toString(),27));
  await ethers.provider.send("hardhat_mine", ["0x989680"]); //10.000.000 blocks
  console.log("DEPOSIT MANAGER BALANCE AFTER MINE BLOCKS UPDATE",ethers.utils.formatUnits((await WTON.balanceOf(depositManagerAddress)).toString(),27));
  const ethToSet = ethers.utils.parseEther("1.0");
  await ethers.provider.send("hardhat_setBalance", [
      Tokamak1Layer2Address,
      ethToSet.toHexString()
  ]);

  console.log("Block number: ",await ethers.provider.getBlockNumber());
  const updateTX = await SeigManager.connect(signerForLayer2).updateSeigniorage();
  await updateTX.wait();

  console.log("DEPOSIT MANAGER BALANCE AFTER UPDATE",ethers.utils.formatUnits((await WTON.balanceOf(depositManagerAddress)).toString(),27));

  const balanceAfterUpdate = await CoinAge.balanceOf(deployer.address);
  console.log("Block number: ",await ethers.provider.getBlockNumber());
  console.log("User WTON balance after updateSeigniorage:", ethers.utils.formatUnits(balanceAfterUpdate, 27));
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [Tokamak1Layer2Address]);
  console.log()

  let totalWTONSupplyAfterMine =  ethers.utils.formatUnits((await WTON.totalSupply()),27)
  console.log("Total WTON supply after mine: ", totalWTONSupplyAfterMine);

  let totalTONSupplyAfterMine =  ethers.utils.formatUnits((await TON.totalSupply()),"ether")
  console.log("Total TON supply after mine: ", totalTONSupplyAfterMine);

  let prevTotSupplyAfterUpdate = await SeigManager.stakeOfTotal();
  console.log("prevTotSupplyAfterUpdate: ", ethers.utils.formatUnits(prevTotSupplyAfterUpdate, 27));

  let afterUpdateSeigniorageTotalSupply = ethers.BigNumber.from(await refactorContractUpdateSeignioarege.totalSupply())
  console.log("afterUpdateSeigniorageTotalSupply ",  ethers.utils.formatUnits(afterUpdateSeigniorageTotalSupply,27))

  console.log("===============Withdraw request===============");

  //Request to withdraw 10 tokens
  const rwTx = await DepositManager.requestWithdrawal(Tokamak1Layer2Address, "10000000000000000000000000000");
  await rwTx.wait();

  const walletWTONAmountBeforeWithdraw = await WTON.balanceOf(deployer.address);
  console.log("User WTON balance in wallet before processing withdrawal:", ethers.utils.formatUnits(walletWTONAmountBeforeWithdraw, 27));
  //Cover DTD
  await ethers.provider.send("hardhat_mine", ["0x989680"]);
  const prTx = await DepositManager.processRequest(Tokamak1Layer2Address, false);
  await prTx.wait();

  const finalWtonBalance = await WTON.balanceOf(deployer.address);
  console.log("User WTON balance in wallet after processing withdrawal:", ethers.utils.formatUnits(finalWtonBalance, 27));
  console.log()
}


async function updateSeigniorage() {
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );
  let blockNumber = await ethers.provider.getBlockNumber();
  let lastSeigBlock = await SeigManager.lastSeigBlock();
  if (blockNumber <= lastSeigBlock) {
    return;
  }

  const Tokamak1Layer2Address = "0x36101b31e74c5E8f9a9cec378407Bbb776287761";
  await ethers.provider.send("hardhat_impersonateAccount", [
    Tokamak1Layer2Address,
  ]);
  const signerForLayer2 = await ethers.getSigner(Tokamak1Layer2Address);
  const ethToSet = ethers.utils.parseEther("1.0");
  await ethers.provider.send("hardhat_setBalance", [
    Tokamak1Layer2Address,
    ethToSet.toHexString(),
  ]);

  //RAY FORMAT
  let operatorAmount = await getOperatorAmount(Tokamak1Layer2Address);
  let minimumAmount = await SeigManager.minimumAmount();
  if (operatorAmount < minimumAmount) {
    return;
  }

  let coinage = await SeigManager.coinages(Tokamak1Layer2Address);
  _increaseTot();

  let _lastCommitBlockL1 = blockNumber;
  const RefactorCoinageSnapshotI = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    coinage
  );
  let prevTotalSupply = ethers.BigNumber.from(
    await RefactorCoinageSnapshotI.totalSupply()
  );

  let _totAddress = await SeigManager.tot();
  const RefactorCoinageSnapshotIForTOT = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    _totAddress
  );
  let nextTotalSupply = ethers.BigNumber.from(
    await RefactorCoinageSnapshotIForTOT.balanceOf(Tokamak1Layer2Address)
  );
  if (prevTotalSupply.gt(nextTotalSupply)) {
    return true;
  }

  let seigs = ethers.BigNumber.from(nextTotalSupply).sub(
    ethers.BigNumber.from(prevTotalSupply)
  );
  let Layer2Instance = await ethers.getContractAt(
    Layer2IABI,
    Tokamak1Layer2Address
  );
  let operator = await Layer2Instance.operator();

  let isCommissionRateNegative_ = await SeigManager.isCommissionRateNegative(
    Tokamak1Layer2Address
  );
  let operatorSeigs;
  let result = await _calcSeigsDistribution(
    Tokamak1Layer2Address,
    coinage,
    prevTotalSupply,
    seigs,
    isCommissionRateNegative_,
    operator
  );
  console.log(
    "prev tot supply ",
    ethers.utils.formatUnits(prevTotalSupply, 27)
  );
  console.log(
    "nextTotalSupply from calc ",
    ethers.utils.formatUnits(result[0], 27)
  );

  console.log("operatorSeigs ", result[1]);
  let coinageFactor = await RefactorCoinageSnapshotI.factor();
  console.log(" coinageFactor ", ethers.utils.formatUnits(coinageFactor, 27));
  // let setFactorValue = _calcNewFactor(prevTotalSupply,result[0], coinageFactor);
  // await RefactorCoinageSnapshotI.connect(signerForLayer2).setFactor(setFactorValue);
}

async function _increaseTot() {
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );
  let seigPerBlock = ethers.BigNumber.from(await SeigManager.seigPerBlock());
  let blockNumber = await ethers.provider.getBlockNumber();

  if (blockNumber <= seigPerBlock) {
    return false;
  }
}

async function getOperatorAmount(layer2) {
  let Layer2Instance = await ethers.getContractAt(Layer2IABI, layer2);
  let operatorAddress = await Layer2Instance.operator();
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );
  let coinAges = await SeigManager.coinages(layer2);
  const refactorContractUpdateSeignioaregeTotToken = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    coinAges
  );
  let balance = await refactorContractUpdateSeignioaregeTotToken.balanceOf(
    operatorAddress
  );
  return balance;
}

async function _calcSeigsDistribution(
  layer2,
  coinage,
  prevTotalSupplyValue,
  seigs,
  _isCommissionRateNegative,
  operator
) {
  console.log("Calc distribution");
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const Tokamak1Layer2Address = "0x36101b31e74c5E8f9a9cec378407Bbb776287761";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );
  let _commissionRatesL2;
  let operatorSeigs = 0;
  let delayedCommissionBlockL2 = await SeigManager.delayedCommissionBlock(
    layer2
  );
  let blockNumber = await ethers.provider.getBlockNumber();
  if (
    blockNumber >= delayedCommissionBlockL2 &&
    delayedCommissionBlockL2 != 0
  ) {
    console.log(
      "blockNumber >= delayedCommissionBlock && delayedCommissionBlock !=0"
    );
    _commissionRatesL2 = await SeigManager.delayedCommissionRate(
      Tokamak1Layer2Address
    );
    _isCommissionRateNegativeL2 =
      await SeigManager.delayedCommissionRateNegative(Tokamak1Layer2Address);
    delayedCommissionBlockL2 = 0;
  }
  let comissionRate = await SeigManager.commissionRates(Tokamak1Layer2Address);
  let nextTotSupply = ethers.BigNumber.from(prevTotalSupplyValue).add(
    ethers.BigNumber.from(seigs)
  );
  console.log("nextTotSupply ", nextTotSupply);
  console.log(comissionRate);
  if (comissionRate == 0) {
    console.log("comissionRate=0");
    return [nextTotSupply, operatorSeigs];
  }
  if (!_isCommissionRateNegative) {
    console.log("_isCommissionRateNegative ");
    operatorSeigs = ethers.BigNumber.from(seigs).mul(
      ethers.BigNumber.from(comissionRate)
    );
    nextTotSupply = ethers.BigNumber.from(nextTotSupply).sub(
      ethers.BigNumber.from(operatorSeigs)
    );
    console.log(operatorSeigs);
    console.log(nextTotSupply);
    return [nextTotSupply, operatorSeigs];
  }

  if (prevTotalSupplyValue == 0) {
    console.log("prevTotalSupplyValue===0");
    return [nextTotSupply, operatorSeigs];
  }

  let coinAgeContract = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    coinage
  );
  let operatorBalance = await coinAgeContract.balanceOf(operator);
  if (operatorBalance === 0) {
    return [nextTotSupply, operatorSeigs];
  }

  let operatorRate = ethers.BigNumber.from(operatorBalance).div(
    ethers.BigNumber.from(prevTotalSupplyValue)
  );
  let seigsOperatorRate = ethers.BigNumber.from(seigs).mul(
    ethers.BigNumber.from(operatorRate)
  );
  operatorSeigs = ethers.BigNumber.form(comissionRate).mul(seigsOperatorRate);

  let RAY = ethers.BigNumber.from("1000000000000000000000000000");
  let delegatorSeigsElseFirstPart = ethers.BigNumber.from(RAY).sub(
    ethers.BigNumber.from(operatorRate)
  );
  let delegatorSeigsElseSecondPart = ethers.BigNumber.from(operatorSeigs).div(
    delegatorSeigsElseFirstPart
  );

  let delegatorSeigs =
    ethers.BigNumber.from(operatorRate) === ethers.BigNumber.from(RAY)
      ? operatorSeigs
      : delegatorSeigsElseSecondPart;

  let operatorSeigsElseFirstPart = ethers.BigNumber.from(delegatorSeigs).mul(
    ethers.BigNumber.from(operatorRate)
  );
  let operatorSeigsElseSecondPart =
    operatorSeigsElseFirstPart.add(operatorSeigs);
  operatorSeigs =
    ethers.BigNumber.from(operatorRate) === ethers.BigNumber.from(RAY)
      ? operatorSeigs
      : operatorSeigsElseSecondPart;

  nextTotSupply = nextTotSupply.add(delegatorSeigs);
  console.log("last");
  return [nextTotSupply, operatorSeigs];
}

function _calcNewFactor(source, target, oldFactor) {
  let firstPart = ethers.BigNumber.from(target).mul(
    ethers.BigNumber.from(oldFactor)
  );
  return firstPart.div(ethers.BigNumber.from(source));
}

stakingInteraction();
