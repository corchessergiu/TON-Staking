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

  //Build data field, 2 addresses: depositManagerAddress and Tokamak1Layer2Address
  let firstDataPart = padLeft(unmarshalString(depositManagerAddress), 64);
  let secondPart = unmarshalString(
    padLeft(unmarshalString(Tokamak1Layer2Address), 64)
  );
  const data = firstDataPart + secondPart;
  const amountInWeiForApproveAndCall = ethers.utils.parseEther("100");
  console.log(
    "===============CALL approveAndCall FROM TON for 100 tokens==============="
  );
  console.log();
  console.log();
  console.log();
  await TON.approveAndCall(
    WTONMainnetAddress,
    amountInWeiForApproveAndCall,
    data
  );

  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );
  const coinageAddress = await SeigManager.coinages(Tokamak1Layer2Address);
  const CoinAge = await ethers.getContractAt(CoinAgeABI, coinageAddress);
  const coinageBalance = await CoinAge.balanceOf(deployer.address);

  console.log(
    "User WTON balance before update: ",
    ethers.utils.formatUnits(coinageBalance, 27)
  );
  console.log();

  await ethers.provider.send("hardhat_mine", ["0x989680"]);

  let blockNumber = await ethers.provider.getBlockNumber();
  let lastSeigBlock = await SeigManager.lastSeigBlock();
  if (blockNumber <= lastSeigBlock) {
    return;
  }

  let operatorAmount = await getOperatorAmount(Tokamak1Layer2Address);
  let minimumAmount = await SeigManager.minimumAmount();
  if (operatorAmount.lt(minimumAmount)) {
    return;
  }

  let coinage = await SeigManager.coinages(Tokamak1Layer2Address);
  await _increaseTot();
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

  let coinageFactor = await RefactorCoinageSnapshotI.factor();
  await ethers.provider.send("hardhat_impersonateAccount", [
    seigManagetAddress,
  ]);

  const signerForLayer2 = await ethers.getSigner(seigManagetAddress);

  const ethToSet = ethers.utils.parseEther("1.0");
  await ethers.provider.send("hardhat_setBalance", [
    seigManagetAddress,
    ethToSet.toHexString(),
  ]);

  let setFactorValue = _calcNewFactor(
    prevTotalSupply,
    result[0],
    coinageFactor
  );

  await RefactorCoinageSnapshotI.connect(signerForLayer2).setFactor(
    setFactorValue
  );

  console.log("OperatorSeigs ", result[1]);
  // operatorSeigs == 0 here!!!
  // if (operatorSeigs != 0) {
  //   if (isCommissionRateNegative_) {
  //     // TODO: adjust arithmetic error
  //     // burn by 𝜸
  //     coinage.burnFrom(operator, operatorSeigs);
  //   } else {
  //     coinage.mint(operator, operatorSeigs);
  //   }
  // }
  await WTON.connect(signerForLayer2).mint(depositManagerAddress, seigs);
  const coinageBalanceAfter = await RefactorCoinageSnapshotI.balanceOf(
    deployer.address
  );
  console.log(
    "User WTON balance before update: ",
    ethers.utils.formatUnits(coinageBalanceAfter, 27)
  );
}

async function _increaseTot() {
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );
  let lastSeigBlock = await SeigManager.lastSeigBlock();
  let blockNumber = await ethers.provider.getBlockNumber();

  if (blockNumber <= lastSeigBlock) {
    return false;
  }
  let _totAddress = await SeigManager.tot();
  let RefactorCoinageSnapshotContract = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    _totAddress
  );

  let totalSupplyForTOT = await RefactorCoinageSnapshotContract.totalSupply();
  if (totalSupplyForTOT === 0) {
    lastSeigBlock = blockNumber;
    return false;
  }
  const Tokamak1Layer2Address = "0x36101b31e74c5E8f9a9cec378407Bbb776287761";
  let coinage = await SeigManager.coinages(Tokamak1Layer2Address);
  const RefactorCoinageSnapshotI = await ethers.getContractAt(
    RefactorCoinageSnapshotABI,
    coinage
  );

  let prevTotalSupply = await RefactorCoinageSnapshotI.totalSupply();
  let calcPerBlock = await _calcNumSeigBlocks(lastSeigBlock);
  let seigPerBlockNormalFormat = await SeigManager.seigPerBlock();
  let maxSeig = ethers.BigNumber.from(calcPerBlock).mul(
    seigPerBlockNormalFormat
  );

  const TONMainnetAddress = "0x2be5e8c109e2197D077D13A82dAead6a9b3433C5";
  const TON = await ethers.getContractAt(TONABI, TONMainnetAddress);
  const WTONMainnetAddress = "0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2";
  const WTON = await ethers.getContractAt(WTONABI, WTONMainnetAddress);

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
  let initialValue = tonTotalSupply.sub(wtonBalance);
  let secondValue = initialValue.sub(address0Balance).sub(address1Balance);
  let thirdValue = secondValue.mul(1000000000);
  let tosRAY = thirdValue.add(prevTotalSupply);

  let seigFirstPart = ethers.BigNumber.from(maxSeig).mul(prevTotalSupply);
  let stakedSeig = seigFirstPart.div(tosRAY);

  let relativeSeigRate = await SeigManager.relativeSeigRate();
  let totalPseigFP = maxSeig.sub(stakedSeig);
  let totalPseig = totalPseigFP
    .mul(relativeSeigRate)
    .div(ethers.BigNumber.from("1000000000000000000000000000000000000"));
    console.log("taotal pseig!!!!!!!!!!", ethers.utils.formatUnits(totalPseig,27));
  let next1 = prevTotalSupply.add(stakedSeig);
  let nextTotalSupply = next1.add(totalPseig);

  await ethers.provider.send("hardhat_impersonateAccount", [
    seigManagetAddress,
  ]);

  const signerForLayer2 = await ethers.getSigner(seigManagetAddress);
  const ethToSet = ethers.utils.parseEther("1.0");
  await ethers.provider.send("hardhat_setBalance", [
    seigManagetAddress,
    ethToSet.toHexString(),
  ]);

  let coinageFactor = await RefactorCoinageSnapshotContract.factor();

  let setFactorValue = _calcNewFactor(
    prevTotalSupply,
    nextTotalSupply,
    coinageFactor
  );

  await RefactorCoinageSnapshotContract.connect(signerForLayer2).setFactor(
    setFactorValue
  );

  let unstakedSeig = maxSeig.sub(stakedSeig);

  let powerTONAddress = await SeigManager.powerton();
  if (powerTONAddress != "0x0000000000000000000000000000000000000000") {
    let powerTONSeigRate = await SeigManager.powerTONSeigRate();
    let powerTonSeig = powerTONSeigRate.mul(unstakedSeig);
    let valueForFUnction = powerTonSeig.div(
      ethers.BigNumber.from("1000000000000000000000000000")
    );
    await WTON.connect(signerForLayer2).mint(powerTONAddress, valueForFUnction);
  }
  let dao = await SeigManager.dao();
  if (dao != "0x0000000000000000000000000000000000000000") {
    let daoSeigRate = await SeigManager.daoSeigRate();
    let daoSeig = daoSeigRate.mul(unstakedSeig);
    let valueForFUnction = daoSeig.div(
      ethers.BigNumber.from("1000000000000000000000000000")
    );
    await WTON.connect(signerForLayer2).mint(dao, valueForFUnction);
  }
    let accRelativeSeigRate = await SeigManager.accRelativeSeig();
    console.log("acc relative before ", ethers.utils.formatUnits(accRelativeSeigRate,27));
  if (relativeSeigRate != 0) {
    let  accRelativeSeig = accRelativeSeigRate.add(totalPseig);
    console.log("relative dupaaa: ", ethers.utils.formatUnits(accRelativeSeig,27));
  }
}

async function _calcNumSeigBlocks(lastSeigBlock) {
  const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
  const SeigManager = await ethers.getContractAt(
    SeigManagerABI,
    seigManagetAddress
  );

  let unpausedBlock = await SeigManager.unpausedBlock();
  let pausedBlock = await SeigManager.pausedBlock();
  let blockNumber = await ethers.provider.getBlockNumber();
  let span = blockNumber - lastSeigBlock;
  console.log(unpausedBlock)
  console.log(lastSeigBlock)
  if (unpausedBlock.lt(lastSeigBlock)) {
    return span;
  }
  return span - (unpausedBlock - pausedBlock);
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
  let _isCommissionRateNegativeL2;
  let operatorSeigs = 0;
  let delayedCommissionBlockL2 = await SeigManager.delayedCommissionBlock(
    layer2
  );
  let blockNumber = await ethers.provider.getBlockNumber();
  if (
    blockNumber >= delayedCommissionBlockL2 &&
    delayedCommissionBlockL2 != 0
  ) {
    _commissionRatesL2 = await SeigManager.delayedCommissionRate(layer2);
    _isCommissionRateNegativeL2 =
      await SeigManager.delayedCommissionRateNegative(layer2);
    delayedCommissionBlockL2 = 0;
  }
  let comissionRate = await SeigManager.commissionRates(layer2);
  let nextTotSupply = ethers.BigNumber.from(prevTotalSupplyValue).add(
    ethers.BigNumber.from(seigs)
  );

  if (comissionRate == 0) {
    return [nextTotSupply, operatorSeigs];
  }
  if (!_isCommissionRateNegative) {
    operatorSeigs = ethers.BigNumber.from(seigs).mul(
      ethers.BigNumber.from(comissionRate)
    );
    nextTotSupply = ethers.BigNumber.from(nextTotSupply).sub(
      ethers.BigNumber.from(operatorSeigs)
    );
    return [nextTotSupply, operatorSeigs];
  }

  if (prevTotalSupplyValue == 0) {
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
  return [nextTotSupply, operatorSeigs];
}

function _calcNewFactor(source, target, oldFactor) {
  let firstPart = target.mul(oldFactor);
  return firstPart.div(source);
}

stakingInteraction();
