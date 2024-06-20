const {ethers} = require("hardhat");
const {WETH9ABI} = require("../abis/WETH.json");
const {SwapRouterV2ABI} = require("../abis/SwaoRouter.json");
const {WTONABI} = require("../abis/WTON.json");
const {DepositManagerABI} = require("../abis/DepositManager.json");
const {SeigManagerABI} = require("../abis/SeigManager.json");
const {CoinAgeABI} = require("../abis/CoinAge.json")

async function stakingInteraction() {
    const [deployer] = await ethers.getSigners();
    const WETH9MainnetAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const WTONMainnetAddress = "0xc4A11aaf6ea915Ed7Ac194161d2fC9384F15bff2";
    const SwapRouterV2Address = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
   
    const deployerAddress = await deployer.getAddress();

    const WETH = await ethers.getContractAt(WETH9ABI,WETH9MainnetAddress);
    const SwapRouterV2 = await ethers.getContractAt(SwapRouterV2ABI, SwapRouterV2Address);
    const WTON = await ethers.getContractAt(WTONABI, WTONMainnetAddress);
    const amountInWei = ethers.utils.parseEther("2");

    console.log("===============Convert ETH to WETH===============");
    console.log("Balance of WETH before converting: ", Number(await WETH.balanceOf(deployerAddress)));
    //Convert ETH to WETH
    const tx = await WETH.deposit({ value: amountInWei });
    await tx.wait();
    console.log("Balance of WETH after converting: ", ethers.utils.formatUnits(await WETH.balanceOf(deployerAddress)));

    console.log()
    console.log("===============Check allowance for swapRouter===============");
    console.log("Initial allowance for swapRouter contract: ",(Number(await WETH.allowance(deployerAddress,SwapRouterV2Address))));
    const txApprove = await WETH.approve(SwapRouterV2Address,amountInWei);
    await txApprove.wait();
    console.log("SwapRouter allowance after approve: ",ethers.utils.formatEther((await WETH.allowance(deployerAddress,SwapRouterV2Address)).toString()));
    console.log()

    console.log("===============Swap WETH TO WTON===============");
    let balanceWTONBeforeSwap = await WTON.balanceOf(deployerAddress);
    console.log("WTON balance before swap: ",ethers.utils.formatUnits(balanceWTONBeforeSwap,27));
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
    console.log("WTON balance for deployer after swap: ", ethers.utils.formatUnits(balanceWTONAfterSwap,27));
    console.log()

    console.log("===============Check allowance for DepositManager===============");
    const depositManagerAddress = "0x0b58ca72b12f01fc05f8f252e226f3e2089bd00e";
    const DepositManager = await ethers.getContractAt(DepositManagerABI,depositManagerAddress);
    const amountToDeposit = ethers.utils.parseUnits("1000", 27); 
    
    console.log("Initial WTON allowance for deposit manager: ",Number(await WTON.allowance(deployerAddress, depositManagerAddress)));
    const approveTx = await WTON.approve(depositManagerAddress, amountToDeposit);
    await approveTx.wait();
    console.log("WTON allowance for deposit manager after approve: ", ethers.utils.formatUnits((await WTON.allowance(deployerAddress, depositManagerAddress)),27));
    
    const Tokamak1Layer2Address = "0xf3B17FDB808c7d0Df9ACd24dA34700ce069007DF";
    console.log();
    console.log("===============Check mappings from DepositManager balance===============");
    console.log("AccStakedAccount balance before deposit in Manager contract: ", ethers.utils.formatUnits((await DepositManager.accStakedAccount(deployerAddress)),27));
    console.log("Total WTON stake by user on Layer2 before deposit: ", ethers.utils.formatUnits((await DepositManager.accStaked(Tokamak1Layer2Address, deployerAddress)),27));
    const depositTx = await DepositManager["deposit(address,uint256)"](Tokamak1Layer2Address, amountToDeposit);
    await depositTx.wait();
    console.log("AccStakedAccount balance after deposit in Manager contract: ", ethers.utils.formatUnits((await DepositManager.accStakedAccount(deployerAddress)),27));
    console.log("Total WTON stake by user on Layer2 after deposit: ", ethers.utils.formatUnits((await DepositManager.accStaked(Tokamak1Layer2Address, deployerAddress)),27));
    console.log();

    console.log("===============Check data from CoinAge contract===============");
    const seigManagetAddress = "0x0b55a0f463b6defb81c6063973763951712d0e5f";
    const SeigManager = await ethers.getContractAt(SeigManagerABI, seigManagetAddress);
    
    const coinageAddress = await SeigManager.coinages(Tokamak1Layer2Address);
    const CoinAge = await ethers.getContractAt(CoinAgeABI,coinageAddress);
    const coinageBalance = await CoinAge.balanceOf(deployer.address);
    console.log("User sWTON balance after deposit:", ethers.utils.formatUnits(coinageBalance, 27));

    const newWtonBalance = await WTON.balanceOf(deployer.address);
    console.log("User WTON balance in wallet:", ethers.utils.formatUnits(newWtonBalance, 27));
    console.log()

    console.log("===============Update Seigniorage===============");
    //Impersonate the Layer2 address for update the seigniorage
    await ethers.provider.send("hardhat_impersonateAccount", [Tokamak1Layer2Address]);
    const signerForLayer2= await ethers.getSigner(Tokamak1Layer2Address);

    await ethers.provider.send("hardhat_mine", ["0x4C4B40"]); //5.000.000 blocks

    const ethToSet = ethers.utils.parseEther("1.0"); 
    await ethers.provider.send("hardhat_setBalance", [
        Tokamak1Layer2Address,
        ethToSet.toHexString()
    ]);

    const updateTX = await SeigManager.connect(signerForLayer2).updateSeigniorage();
    await updateTX.wait();

    const balanceAfterUpdate = await CoinAge.balanceOf(deployer.address);
    console.log("User sWTON balance after updateSeigniorage:", ethers.utils.formatUnits(balanceAfterUpdate, 27));
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [Tokamak1Layer2Address]);
    console.log()

    console.log("===============Withdraw request===============");
    const amountForWithdraw = ethers.utils.parseUnits("50", 27);
    const rwTx = await DepositManager.requestWithdrawal(Tokamak1Layer2Address, amountForWithdraw);
    await rwTx.wait();

    //Cover DTD
    await ethers.provider.send("hardhat_mine", ["0x4C4B40"]);
    const prTx = await DepositManager.processRequest(Tokamak1Layer2Address, false);
    await prTx.wait();

    console.log("User WTON balance in wallet:", ethers.utils.formatUnits((await WTON.balanceOf(deployer.address)), 27));
    console.log()
}   

stakingInteraction();