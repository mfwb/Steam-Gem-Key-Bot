// ■ ■ ■ ■ ■  Created By mfw (https://steamcommunity.com/id/mfwBan)
// ■ ■ ■ ■ ■  For releasing this for free, if you'd like to donate, please use the information below!

// ■ ■  Bitcoin : 38W4jPsu9xZCFptbAK6PERCPBiXM4UdxaV
// ■ ■  CashApp : $mfwBan 
// ■ ■  Dogecoin : A6vcbwZGpADw1ai9SekPFXDkVsGNJY45Py
// ■ ■  Litecoin : 34hn5T1rHCDn8x39HMgJWDjcXKVjsBoJvi





module.exports = {
    USERNAME: "",
    PASSWORD: "",
    IDENTITYSECRET: "",
	SHAREDSECRET: "",
    INVITETOGROUPID: "", // Invite users to this group
	STEAMAPIKEY: "", // For checking Gem Values
    
	
	MAXMSGPERSEC: 2,
	Owner: ["","",""],  // In the first slot, put in the SteamID of the bot (between ""), after that put in the SteamID's of admins (so you get  Admin commands)
	Comment_After_Trade: "+Rep! Thanks for using my Bot!\r\nHope to see you again soon!",  // Comment this after trade (leave blank if you don't want to comment)
	Ignore_Msgs: ["","",""], // the bot will ignore msg's from these users + ignore trade offers [it won't decline or accept], (useful for when you want to buy sets from other bots & don't want them to block eachother)

    Rates: { // These rates are optional. It's your responsibility to update them frequently
		
			
		Key_Swaps:{
			
			CS_To_TF2: [1,2], // !SwapTF Rate - You're giving X CS:GO keys for their X TF2 Keys (Choose what keys you're giving/receiving below)
			TF2_To_CS: [1,2], // !SwapCS Rate - You're giving X TF2 keys for their X CS:GO Keys (Choose what keys you're giving/receiving below)
			
			// To change the rates above: 
				// *the first number is how many keys YOU'RE giving
				// *the second number is how many keys THEY'RE giving
				
			Max_Swap: 2 // users can only swap up to X keys at a time
		},
		
			// Buy Rates
		
		BUY:{ 
			Gems_To_TF2_Rate:7550, // User gives us X Gems for X of OUR TF2 Keys
			Gems_To_CSGO_Rate: 7800, // User gives us X Gems for X of OUR CS:GO Keys
			BG_And_Emotes: 9 // Buy THEIR Backgrounds & Emotes for X Gems Each 
		},
			// Sell Rates
		
		SELL:{ 
			TF2_To_Gems: 7300, // User gives us X TF2 Keys for Our X Gems
			CSGO_To_Gems:7450, // User gives us X CSGO Keys  for Our X Gems
			BG_And_Emotes: 15 // Sell YOUR Backgrounds & Emotes for X Gems Each (if you have bg's & emotes you don't want to sell, put their name in ItemsNotForTrade below between '')
		}
    },
	Restrictions:{
		ItemsNotForTrade: [':cleancake:',':cleankey:','A Clean Garage',':cleandino:',':cleanfloppy:',':dustpan:',':featherduster:',':cleanhourglass:',':goldfeatherduster:','A Work-in-Progress Garage',':cleanseal:','A Slightly Cleaner Garage','A Messy Garage','Dirty and Dusty','All Tidied Up',':csgo_despair',':csgo_gg',':csgo_chicken:',':csgo_headshot:',':csgo_dead:',':csgo_banana:',':csgo_explosion:',':csgo_clutch:',':csgo_loser:',':csgo_ez:',':csgo_crown:'],
		MaxBuy: 200, // Maximum Emotes/BG's you will buy in a single trade.
		MaxSell: 500, // Maximum emotes/BG's you will sell in a single trade.
		Convert_To_Gems: 20 // Gem any Emotes/BG's above this Value every week.
	},
    MESSAGES: {
        WELCOME: "Hello, welcome to my Key-BG-Emote-Gems Swap Bot. Let's get started! Type !help, !check, or !info.\r\n\r\nIn the case of any unforeseen errors or problems with trading; please check and or post it on our steam group.\r\n", // Message sent when they first add you.
		BROADCAST: "", // For the !Broadcast command. Do not abuse this.
        HELP: "Available Commands:\r\n\r\n!Prices  ⮞ Check our current Rates/Prices\r\n!Price  ⮞ Check our current Rates/Prices\r\n!Rate  ⮞ Check our current Rates/Prices\r\n!Rates  ⮞ Check our current Rates/Prices\r\n\r\n!Check ⮞ Check how many Keys & Gems you have to see what we have to offer you!\r\n\r\n!Info ⮞ Info about Owner + Misc other information\r\n\r\n!BuyCS [# of CS:GO Keys] ⮞ Buy CS:GO Keys for Gems\r\n!BuyTF [# of TF2 Keys] ⮞ Buy TF2 Keys for Gems\r\n\r\n!SwapCS [# of CS:GO Keys] ⮞ Swap CS:GO Keys for TF2 Keys\r\n!SwapTF [# of TF2 Keys] ⮞ Swap TF2 Keys for CS:GO Keys\r\n\r\n!SellCS [# of CS:GO Keys] ⮞ Sell CS:GO Keys for Gems\r\n!SellTF [# of TF2 Keys] ⮞ Sell TF2 Keys for Gems\r\n\r\nWe're also:\r\nBuying Your Backgrounds & Emotes for 9 Gems ea!\r\nJust start a Trade Offer with me and enter any/ all Emoticons/Backgrounds you would like to sell! Then, Add the correct rate of gems from my inventory into the trade. (9 Gems per Emote/BG) Bot will auto accept if rates match/will decline if they do not.\r\n" // Check for anything you want to change.
    },
		
	TF2_Keys: [
		"Mann Co. Supply Crate Key"
	],
	CSGO_Keys: [
	"Clutch Case Key",
	"Glove Case Key",
	"Gamma Case Key",
	"Gamma 2 Case Key",
	"Chroma Case Key",
	"Chroma 2 Case Key",
	"Chroma 3 Case Key",
	"Spectrum Case Key",
	"Spectrum 2 Case Key",
	"Operation Phoenix Case Key",
	"Falchion Case Key",
	"Operation Breakout Case Key",
	"Operation Wildfire Case Key",
	"eSports Key",
	"Winter Offensive Case Key",
	"Operation Vanguard Case Key",
	"Shadow Case Key",
	"Horizon Case Key",
	"Danger Zone Case Key",
	"Prisma Case Key"
	]
}
