pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false    
    uint256 public constant MAXINSURANCEAMOUNT = 1 ether;
    uint256 public constant MINAIRLINEFUNDING = 10 ether;

    struct Airline {
        string name;
        address addressOfAirline;
    }

    struct Flight {
        string flight;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    struct Insurance{
        address passenger;
        bytes32 flightId;
        uint256 amount;
    }
    
    mapping(bytes32 => Flight) private flights;
    mapping(bytes32 => Insurance) private insuranceManifest;
    mapping(address => uint256) private insuranceClaims;
    mapping(address => bool) private authorizedCallers;
    mapping(address => uint256) private funds;
    mapping(address => Airline) private registeredAirlines; // keeps track of airlines that registered
    uint256 private numAirlinesRegistered = 0;
    bytes32[] private registeredInsurees = new bytes32[](0);
    bytes32[] private flightSchedules = new bytes32[](0); // keeps track of all the flights


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event ClaimIsReady(address passenger, uint claimAmount);


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor ( ) public 
    {
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }
   
    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }
    modifier isCallerAuthorized()
    {
        require(authorizedCallers[msg.sender] == true, "Caller is not contract owner");
        _;
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus ( bool mode )  external requireContractOwner 
    {
        operational = mode;
    }
    // used to determine if an airlines is registered in the system
    function isAirlineRegistered(address airline) external view returns (bool) {
        return registeredAirlines[airline].addressOfAirline == airline;
    }
    //use to determine if the caller has authority to add a new airline
    function isAirlineAuthorized(address airline) public view returns (bool) {
        return authorizedCallers[airline];
    }
    function isAirlineFunded(address airline) public view returns (bool) {
        return funds[airline] >= MINAIRLINEFUNDING;
    }
    function isFlightRegistered(address airline, string memory flight, uint256 timestamp ) public view returns (bool) {
        bytes32 id = getFlightKey(airline, flight, timestamp);
        return flights[id].isRegistered;
    }
     function authorizeCaller(address dataContract) external requireIsOperational requireContractOwner {
        authorizedCallers[dataContract] = true;
    }
    function deauthorizeCaller(address dataContract) external requireIsOperational requireContractOwner {
        authorizedCallers[dataContract] = false;
    }
    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
// region AirlineManagement

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline (string calldata airlineName, address addressOfAirline) isCallerAuthorized external
    {
        require(registeredAirlines[addressOfAirline].addressOfAirline == address(0), "This airline is already registered");
        registeredAirlines[addressOfAirline] = Airline({name: airlineName,  addressOfAirline:addressOfAirline });
        numAirlinesRegistered = numAirlinesRegistered.add(1); // need to keep track of registered airlines separately since cant determine length of mapping
    }
    function getRegisteredAirlineCount() public view returns (uint256) {
        return numAirlinesRegistered;
    }
// endregion

// region FlightManagement
    function registerFlight (string calldata flight,uint256 timestamp,address airline) external{
        bytes32 id = getFlightKey(airline, flight, timestamp);
        // fail- fast - ensure flight is not already registered
        require(isFlightRegistered(airline, flight, timestamp) == false, "Flight is already registered");
        flights[id].flight = flight;
        flights[id].isRegistered = true;
        flights[id].airline = airline;
        flights[id].statusCode = 0;
        flights[id].updatedTimestamp = timestamp;
        flightSchedules.push(id);
    }
    function uintToString(uint v) internal pure returns (string memory str) {
        uint maxlength = 100;
        bytes memory reversed = new bytes(maxlength);
        uint i = 0;
        while (v != 0) {
            uint remainder = v % 10;
            v = v / 10;
            reversed[i++] = byte(uint8(48 + remainder));
        }
        bytes memory s = new bytes(i + 1);
        for (uint j = 0; j <= i; j++) {
            s[j] = reversed[i - j];
        }
        str = string(s);
    }
    //https://ethereum.stackexchange.com/questions/69077/how-can-i-return-dynamic-string-array-in-solidity
    function getFlights() external view returns (string[] memory){
        
        string[] memory currentFlights = new string[](flightSchedules.length);

        for (uint i = 0; i < flightSchedules.length; ++i) {
            currentFlights[i] =  string(abi.encodePacked(flights[flightSchedules[i]].flight," @ ",uintToString(flights[flightSchedules[i]].updatedTimestamp)));  
        }
        return (currentFlights);
    }
    function getFlightKey ( address airline, string memory flight, uint256 timestamp ) pure internal returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }
    function getFlightKeyWithPassenger ( address airline, string memory flight, uint256 timestamp,address passenger ) pure internal returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp,passenger));
    }
// endregion 

//region InsuranceManagement
   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy (address airline, uint256 timestamp,string calldata flight, address passenger) external payable
    {
        bytes32 id = getFlightKey(airline, flight, timestamp);
        bytes32 passengerFlightId = getFlightKeyWithPassenger(airline, flight, timestamp,passenger);
        // fail- fast - ensure flight exists
        require(isFlightRegistered(airline, flight, timestamp) == true, "Flight doesn't exist");
        insuranceManifest[passengerFlightId].passenger = passenger;
        insuranceManifest[passengerFlightId].flightId = id;
        insuranceManifest[passengerFlightId].amount = msg.value;
        registeredInsurees.push(passengerFlightId);

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees (address airline, string calldata flight, uint256 timestamp ) external
    {
        bytes32 delayedFlightId = getFlightKey(airline, flight, timestamp);
        for (uint i = 0; i < registeredInsurees.length; i++) {
            bytes32 ri = registeredInsurees[i];
            Insurance memory insuranceRecord = insuranceManifest[ri];
            
            if(insuranceRecord.amount == 0) continue; // prevent funding repeatedly
            if(insuranceRecord.flightId == delayedFlightId) {
                uint256 payoutAmount = (insuranceRecord.amount.mul(150)).div(100);                
                address passenger = insuranceRecord.passenger;
                insuranceManifest[ri].amount = 0;
                insuranceClaims[passenger]  = payoutAmount;
                emit ClaimIsReady(insuranceRecord.passenger,payoutAmount);
            }
        }
    }
    function addressToString(address _addr) public pure returns(string memory) {
    bytes32 value = bytes32(uint256(_addr));
    bytes memory alphabet = "0123456789abcdef";

    bytes memory str = new bytes(42);
    str[0] = '0';
    str[1] = 'x';
    for (uint i = 0; i < 20; i++) {
        str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
        str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
    }
    return string(str);
}

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay (address payable passenger) external payable
    {
        uint claimAmount = insuranceClaims[passenger];
        insuranceClaims[passenger] = 0;
        passenger.transfer(claimAmount);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund (address senderAddress) public payable
    {
        require(msg.value > 0, "Must provided more than 0 funds");
        funds[senderAddress] = funds[senderAddress].add(msg.value);
    }
// endregion
  
    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external  
    {
        require(false, "THe function you are calling doesn't exist");
    }


}

