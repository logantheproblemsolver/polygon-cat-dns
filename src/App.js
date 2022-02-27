import React, { useEffect, useState } from 'react';
import './styles/App.css';
import { ethers } from 'ethers';
import contractAbi from "./utils/contractAbi.json";
import { networks } from "./utils/networks";


//Images
import twitterLogo from './assets/twitter-logo.svg';
import polygonLogo from "./assets/polygonlogo.png";
import ethLogo from "./assets/ethlogo.png";

// Constants
const TWITTER_HANDLE = '_buildspace';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
//Add the domain you will be minting
const tld = ".cat";
const CONTRACT_ADDRESS = '0x72809fd489a5e7354dAC43bB2FedA3a6B40Ae538';

const App = () => {

  //State variable we use to store customer's wallet
  const [currentAccount, setCurrentAccount] = useState('');
  //State date for domain and records
  const [domain, setDomain] = useState('');
  const [record, setRecord] = useState('');
  //State variable to save network stuff
  const [network, setNetwork] = useState("");
  //State variable to tell if we're in "edit" mode
  const [editing, setEditing] = useState(false);
  //Stateful array to show all minted domains
  const [mints, setMints] = useState([]);
  
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("Get metamask! -> https://metamask.io");
        return;
      }

      //Fancy method to request access to account;
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });

      //Sweet! This should print out the public address once we authorize Metamask
      console.log("Connected: ", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (e) {
      console.error(e);
    }
  }
  
  //Gotta make sure this is async
  const checkIfWalletIsConnected = async () => {
    //We gotta make sure we have access to window.ethereum;
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Make sure you have Metamask!");
      return;
    } 

    console.log("We have the ethereum object: ", ethereum);

    //Check if we have access to user's wallet
    const accounts = await ethereum.request({ method: 'eth_accounts' })

    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log("Found an authorized account: ", account);
      setCurrentAccount(account);
    } else {
      console.log("No authorized account found");
    }

    //we check the users network ID
    const chainId = await ethereum.request({ method: 'eth_chainId' })
    setNetwork(networks[chainId]);
    ethereum.on('chainChanged', handleChainChanged);

    //reload the page when they change networks
    function handleChainChanged(_chainId) {
      window.location.reload();
    }
  }

  const switchNetwork = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{
            chainId: '0x13881' //check network.js for hexidecimal network ids
          }]
        })
      } catch (e) {
        console.error(e);
        //this error code means that the chain we want has not been added to the users metamask
        if (e.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0x13881",
                  chainName: "Polygon Mumbai Testnet",
                  rpcUrls: ["https://rpc-mumbai.maticvigil.com/"],
                  nativeCurrency: {
                    name: "Mumbai Matic",
                    symbol: "MATIC",
                    decimals: 18
                  },
                  blockExploreUrls: ["https://mumbai.polygonscan.com/"]
                }
              ]
            })
          } catch (e) {
            console.error(e);
          }
        }
      }
    } else {
      // If window.ethereum is not found, then metamask is not installed
      alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
    }
  }

  const mintDomain = async () => {
    console.log(domain);
    console.log(record);
    //don't run if domain is empty
    if (!domain) return;
    // alert the user if the domain is too short
    if (domain.length < 3) {
      alert('Domain must be at least 3 characters long');
      return;
    }

    //calculate price based on the domain -- base this off of your contract
    const price = domain.length === 3 ? "0.5" : domain.length === 4 ? "0.3" : "0.1";
    console.log("Minting Domain: ", domain, "with price", price);
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        console.log(provider);
        const signer = provider.getSigner();
        console.log(signer);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);
        console.log(contract);
        console.log("Going to pop wallet now to pay gas...");
        let tx = await contract.register(domain, { value: ethers.utils.parseEther(price)});
        console.log(tx);
        //Wait for the transaction to be mined
        const receipt = await tx.wait();
        console.log("receipt status: ", receipt);
        //Check if transaction was successfully completed
        if (receipt.status === 1) {
          console.log("Domain minted! https://mumbai.polygonscan.com/tx/"+tx.hash);

          tx = await contract.setRecord(domain, record);
          await tx.wait();

          console.log("Record set! https://mumbai.polygonscan.com/tx/"+tx.hash);

            // Call fetchMints after 2 seconds
          setTimeout(() => {
            fetchMints();
          }, 2000);


          setRecord('');
          setDomain('');
        } else {
          alert("transaction failed, please try again");
        }
      }
    } catch (e) {
      console.error("minting error: ", e);
    }

  }

  const fetchMints = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        // You know all this
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);
          
        // Get all the domain names from our contract
        const names = await contract.getAllNames();
          
        // For each name, get the record and the address
        const mintRecords = await Promise.all(names.map(async (name) => {
        const mintRecord = await contract.records(name);
        const owner = await contract.domains(name);
        return {
          id: names.indexOf(name),
          name: name,
          record: mintRecord,
          owner: owner,
        };
      }));
  
      console.log("MINTS FETCHED ", mintRecords);
      setMints(mintRecords);
      }
    } catch(e) {
      console.error(e);
    }
  }


  const updateDomain = async () => {
    if (!record || !domain) { return };
    setLoading(true);
    console.log("Updating domain ", domain, "with record ", record);

    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = new provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

        let tx = await contract.setRecord(domain, record);
        await tx.wait();
        console.log("Record set https://mumbai.polygonscan.com/tx/"+tx.hash);

        fetchMints();
        setRecord("");
        setDomain("");
      } 
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  }

  //Make a render function in case the wallet isn't connected yet
  const renderNotConnectedContainer = () => (
    <div className="connect-wallet-container">
      <img src="https://media.giphy.com/media/13HBDT4QSTpveU/giphy.gif" alt="Cat Gif" />
      <button onClick={connectWallet} className="cta-button connect-wallet-button">
        Connect Wallet
      </button>
    </div>
  );

  const renderInputForm = () => {
    //if not on the mumbai testnet, then render "Connect to the Mumbai Testnet"
    if (network !== "Polygon Mumbai Testnet") {
      return (
        <div className="connect-wallet-container">
          <p>Please connect to the Polygon Mumbai Testnet</p>
          {/* This button will call the switch network function */}
          <button className="cta-button mint-button" onClick={switchNetwork}>Switch Network</button>
        </div>
      )
    }

    return (
      <div className="form-container">
        <div className="first-row">
          <input 
            type="text"
            value={domain}
            placeholder="domain" 
            onChange={e => setDomain(e.target.value)}
          />
          <p className="tld"> {tld} </p>
        </div>

        <input 
          className="record"
          type="text"
          value={record}
          placeholder="Connect the site to an IP Address"
          onChange={e => setRecord(e.target.value)}
        />
        {/* if editing is set to true, then we will return "set record", if not, then it'll be mint */}
        {editing ? (
          <div className="button-container">
            {/* this will call the updated domain function */}
            <button className="cta-button mint-button" disabled={loading} onClick={updateDomain}>
              Set Record
            </button>
            {/* This will let us get out of editing mode by setting editing to false */}
            <button className="cta-button mint-button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="cta-button mint-button" disabled={null} onClick={mintDomain}>
            Mint
          </button>
        )}

      </div>
    )
  }

  const renderMints = () => {
    if (currentAccount && mints.length > 0) {
      return (
        <div className="mint-container">
          <p className="subtitle"> Recently minted domains!</p>
          <div className="mint-list">
            { mints.map((mint, index) => {
              return (
                <div className="mint-item" key={index}>
                  <div className='mint-row'>
                    <a className="link" href={`https://testnets.opensea.io/assets/mumbai/${CONTRACT_ADDRESS}/${mint.id}`} target="_blank" rel="noopener noreferrer">
                      <p className="underlined">{' '}{mint.name}{tld}{' '}</p>
                    </a>
                    {/* If mint.owner is currentAccount, add an "edit" button*/}
                    { mint.owner.toLowerCase() === currentAccount.toLowerCase() ?
                      <button className="edit-button" onClick={() => editRecord(mint.name)}>
                        <img className="edit-icon" src="https://img.icons8.com/metro/26/000000/pencil.png" alt="Edit button" />
                      </button>
                      :
                      null
                    }
                  </div>
            <p> {mint.record} </p>
          </div>)
          })}
        </div>
      </div>);
    }
  };
  
  // This will take us into edit mode and show us the edit buttons!
  const editRecord = (name) => {
    console.log("Editing record for", name);
    setEditing(true);
    setDomain(name);
  }

  useEffect(() => {
    checkIfWalletIsConnected();
  });

  useEffect(() => {
    if (network === "Polygon Mumbai Testnet") {
      fetchMints();
    }
  }, [currentAccount, network])
  

  return (
		<div className="App">
			<div className="container">

				<div className="header-container">
					<header>
            <div className="left">
              <p className="title">🐱 Cat Domain Service</p>
              <p className="subtitle">Get your Cat domain on the blockchain!</p>
            </div>
            <div className="right">
              <img alt="Network logo" className="logo" src={ network.includes("Polygon") ? polygonLogo : ethLogo } />
              { 
                currentAccount ? 
                <p>Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)} </p> 
                : 
                <p> Not Connected </p>
              }
            </div>
					</header>
				</div>

        {/* hide the connect button if currentAccount is't empty */}
        {!currentAccount && renderNotConnectedContainer()}
        {/* render input form if there is a connected account */}
        {currentAccount && renderInputForm()}
        {mints && renderMints()}

        <div className="footer-container">
					<img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
					<a
						className="footer-text"
						href={TWITTER_LINK}
						target="_blank"
						rel="noreferrer"
					>{`built with @${TWITTER_HANDLE}`}</a>
				</div>
			</div>
		</div>
	);
}

export default App;
