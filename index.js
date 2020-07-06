const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamCommunity = require('steamcommunity');
const sleep = require('system-sleep');
const fs = require('fs');
const CONFIG = require('./SETTINGS/config.js');

const SID64REGEX = new RegExp(/^[0-9]{17}$/);

let userMsgs = {};

function getTime() {
  const time = new Date();
  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const result = `${hours}:${minutes}:${seconds}`;
  return result;
}
const client = new SteamUser();
const manager = new TradeOfferManager({
  language: 'en',
  steam: client,
  pollInterval: '15000',
  cancelTime: '25000',
});
const community = new SteamCommunity();
setInterval(() => {
  // Spam Filter
  for (let i = 0; i < Object.keys(userMsgs).length; i += 1) {
    if (userMsgs[Object.keys(userMsgs)[i]] > CONFIG.MAXMSGPERSEC) {
      client.chatMessage(
        Object.keys(userMsgs)[i],
        "Sorry but we do not like spamming. You've been removed and blocked!",
      );
      client.removeFriend(Object.keys(userMsgs)[i]);
      client.blockUser(Object.keys(userMsgs)[i]);
      for (let j = 0; j < CONFIG.Owner.length; j += 1) {
        client.chatMessage(
          CONFIG.Owner[j],
          `Steam #${Object.keys(userMsgs)[i]} has been blocked for spamming`,
        );
      }
    }
  }
  userMsgs = {};
}, 1000);
client.logOn({
  accountName: CONFIG.USERNAME,
  password: CONFIG.PASSWORD,
  twoFactorCode: SteamTotp.getAuthCode(CONFIG.SHAREDSECRET),
});
client.on('loggedOn', () => {
  if (CONFIG.Owner[0]) {
    client.getPersonas([client.steamID], () => {
      console.log(`[${getTime()}] Successfully Logged Into Your Bot Account`);
      client.setPersona(1);
    });
  } else {
    client.logOff();
  }
});
client.on('webSession', (sessionID, cookies) => {
  manager.setCookies(cookies, (err) => {
    if (err) {
      console.log('## An error occurred while setting cookies.');
    }
  });
  for (let i = 0; i < Object.keys(client.myFriends).length; i += 1) {
    if (client.myFriends[Object.keys(client.myFriends)[i]] == 2) {
      client.addFriend(Object.keys(client.myFriends)[i]);
    }
  }
  community.setCookies(cookies);
  community.startConfirmationChecker(15000, CONFIG.IDENTITYSECRET);
  manager.getInventoryContents(753, 6, true, (ERR, INV) => {
    if (ERR) {
      console.log(ERR);
    } else {
      let My_gems = 0;
      const MyGems = INV.filter((gem) => gem.name == 'Gems');
      if (typeof MyGems[0] !== 'undefined') {
        const gem = MyGems[0];
        My_gems = gem.amount;
      }
      const playThis = `${+My_gems} Gems > Buy/Sell Gems (!prices)`;
      client.gamesPlayed(playThis, true);
    }
  });
});
client.on('friendRelationship', (SENDER, REL) => {
  community.getSteamUser(SENDER, (err, user) => {
    if (err) {
      return console.log(
        `[${getTime()}] Error checking current friend relationship with new customer : ${err}`,
      );
    }
    if (REL === 2) {
      console.log(
        `[${getTime()}] `
        + `[New Friend] - ${user.name} > ${SENDER.getSteamID64()} - SteamID`,
      );
      client.addFriend(SENDER);
    } else if (REL === 3) {
      if (CONFIG.INVITETOGROUPID) {
        client.inviteToGroup(SENDER, CONFIG.INVITETOGROUPID);
        client.chatMessage(SENDER, CONFIG.MESSAGES.WELCOME);
      }
    }
  });
});
community.on('sessionExpired', (ERR) => {
  if (!ERR) {
    console.log(`[${getTime()}] Session Expired. Relogging.`);
    client.webLogOn();
  }
});
community.on('newConfirmation', (CONF) => {
  console.log('## New confirmation.');
  community.acceptConfirmationForObject(
    CONFIG.IDENTITYSECRET,
    CONF.id,
    (ERR) => {
      if (ERR) {
        console.log(
          `## An error occurred while accepting confirmation: ${ERR}`,
        );
      } else {
        console.log('## Confirmation accepted.');
      }
    },
  );
});
manager.on('newOffer', (offer) => {
  offer.getUserDetails((err) => {
    if (err) return console.log(`[${getTime()}] ${err}`);
    console.log(
      `[${getTime()}] `
      + `[New Trade Offer] From:  ${offer.partner.getSteamID64()}`,
    );
    ProccessTradeOffer(offer);
  });
});

function ProccessTradeOffer(offer) {
  const PartnerID = offer.partner.getSteamID64();
  /// ////////////
  offer.getUserDetails((err) => {
    if (err) {
      return console.log(
        `[${getTime()}] An error occured while processing a trade : ${err}`,
      );
    }
    /// ///////////////
    if (CONFIG.Owner.indexOf(PartnerID) >= 0) {
      offer.accept((err) => {
        if (err) {
          console.log(
            `[${getTime()}] Error occured while auto accepting admin trades : ${err}`,
          );
        } else {
          console.log(`[${getTime()}] [Accepted Offer] | ${PartnerID}`);
        }
      });
    } else if (offer.itemsToGive.length === 0) {
      offer.accept((err) => {
        if (err) {
          console.log(
            `[${getTime()}] Error occured accepting donations : ${err}`,
          );
        } else {
          console.log(`[${getTime()}] [Donation Accepted] | ${PartnerID}`);
          client.chatMessage(PartnerID, 'Your donation is appreciated!');
        }
      });
    } else if (offer.itemsToReceive.length > 0) {
      // Selling my bgs
      const MyItems = offer.itemsToGive;
      const tag = MyItems[0].type;
      const TheirItems = offer.itemsToReceive;
      const tag2 = TheirItems[0].type;
      //
      if (tag.includes('Profile Background') || tag.includes('Emoticon')) {
        // BGS/EMOTES 4 Gems Trade
        Sell_Bgs_And_Emotes(offer);
      } else if (
        tag2.includes('Profile Background')
        || tag2.includes('Emoticon')
      ) {
        // My Gems, their bg
        Buy_Bgs_And_Emotes(offer);
      } else {
        offer.decline((err) => {
          if (err) {
            console.log(
              `[${getTime()}] Error declining the trade offer : ${err}`,
            );
          }
          console.log(`[${getTime()}] [Declined Offer]  | ${PartnerID}`);
        });
      }
    } else if (CONFIG.Ignore_Msgs.indexOf(PartnerID) >= 0) {
      //* Checks that the person you're interacting with is/isn't on your ignore list.*//
    } else {
      offer.decline((err) => {
        if (err) {
          console.log(
            `[${getTime()}] Error declining the trade offer : ${err}`,
          );
        }
        console.log(`[${getTime()}] [Declined Offer] | ${PartnerID}`);
      });
    }
  });
}
client.on('friendMessage', (SENDER, MSG) => {
  if (CONFIG.Ignore_Msgs.indexOf(SENDER.getSteamID64()) < 0) {
    community.getSteamUser(SENDER, (err, user) => {
      if (err) {
        return console.log(
          `[${getTime()}] Failure parsing users Steam Info. Possibly illegal ASCII letters in name OR steam failed to : ${err}`,
        );
      }
      console.log(
        `[${getTime()}] `
        + `[Incoming Chat Message] ${
        user.name
        } > ${SENDER.getSteamID64()} : ${MSG}`,
      );
      if (userMsgs[SENDER.getSteamID64()]) {
        userMsgs[SENDER.getSteamID64()] += 1;
      } else {
        userMsgs[SENDER.getSteamID64()] = 1;
      }
      if (MSG.toUpperCase() === '!HELP') {
        client.chatMessage(SENDER, CONFIG.MESSAGES.HELP);
      } else if (MSG.toUpperCase() === '!PRICE') {
        client.chatMessage(
          SENDER,
          `Sell Your: \r\n1 TF2 Key for Our ${CONFIG.Rates.SELL.TF2_To_Gems} Gems\r\n1 CS:GO Key for Our ${CONFIG.Rates.SELL.CSGO_To_Gems} Gems \r\n\r\nBuy Our: \r\n1 TF2 Key for Your ${CONFIG.Rates.BUY.Gems_To_TF2_Rate} Gems\r\n1 CS:GO Key for Your ${CONFIG.Rates.BUY.Gems_To_CSGO_Rate} Gems\r\n\r\nWe're also:\r\nBuying Your Backgrounds & emotes for ${CONFIG.Rates.BUY.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\nSelling any of OUR Backgrounds & emotes for ${CONFIG.Rates.SELL.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\n\r\nKey Swap Rates:\r\nYour ${CONFIG.Rates.Key_Swaps.TF2_To_CS[1]} CS:GO Keys for our ${CONFIG.Rates.Key_Swaps.TF2_To_CS[0]} TF2 Keys -> Use !SwapCS\r\nYour ${CONFIG.Rates.Key_Swaps.CS_To_TF2[1]} TF2 Keys for our ${CONFIG.Rates.Key_Swaps.CS_To_TF2[0]} CS:GO Keys -> Use !SwapTF`,
        );
      } else if (MSG.toUpperCase() === '!RATE') {
        client.chatMessage(
          SENDER,
          `Sell Your: \r\n1 TF2 Key for Our ${CONFIG.Rates.SELL.TF2_To_Gems} Gems\r\n1 CS:GO Key for Our ${CONFIG.Rates.SELL.CSGO_To_Gems} Gems \r\n\r\nBuy Our: \r\n1 TF2 Key for Your ${CONFIG.Rates.BUY.Gems_To_TF2_Rate} Gems\r\n1 CS:GO Key for Your ${CONFIG.Rates.BUY.Gems_To_CSGO_Rate} Gems\r\n\r\nWe're also:\r\nBuying Your Backgrounds & emotes for ${CONFIG.Rates.BUY.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\nSelling any of OUR Backgrounds & emotes for ${CONFIG.Rates.SELL.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\n\r\nKey Swap Rates:\r\nYour ${CONFIG.Rates.Key_Swaps.TF2_To_CS[1]} CS:GO Keys for our ${CONFIG.Rates.Key_Swaps.TF2_To_CS[0]} TF2 Keys -> Use !SwapCS\r\nYour ${CONFIG.Rates.Key_Swaps.CS_To_TF2[1]} TF2 Keys for our ${CONFIG.Rates.Key_Swaps.CS_To_TF2[0]} CS:GO Keys -> Use !SwapTF`,
        );
      } else if (MSG.toUpperCase() === '!RATES') {
        client.chatMessage(
          SENDER,
          `Sell Your: \r\n1 TF2 Key for Our ${CONFIG.Rates.SELL.TF2_To_Gems} Gems\r\n1 CS:GO Key for Our ${CONFIG.Rates.SELL.CSGO_To_Gems} Gems \r\n\r\nBuy Our: \r\n1 TF2 Key for Your ${CONFIG.Rates.BUY.Gems_To_TF2_Rate} Gems\r\n1 CS:GO Key for Your ${CONFIG.Rates.BUY.Gems_To_CSGO_Rate} Gems\r\n\r\nWe're also:\r\nBuying Your Backgrounds & emotes for ${CONFIG.Rates.BUY.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\nSelling any of OUR Backgrounds & emotes for ${CONFIG.Rates.SELL.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\n\r\nKey Swap Rates:\r\nYour ${CONFIG.Rates.Key_Swaps.TF2_To_CS[1]} CS:GO Keys for our ${CONFIG.Rates.Key_Swaps.TF2_To_CS[0]} TF2 Keys -> Use !SwapCS\r\nYour ${CONFIG.Rates.Key_Swaps.CS_To_TF2[1]} TF2 Keys for our ${CONFIG.Rates.Key_Swaps.CS_To_TF2[0]} CS:GO Keys -> Use !SwapTF`,
        );
      } else if (MSG.toUpperCase() === '!PRICES') {
        client.chatMessage(
          SENDER,
          `Sell Your: \r\n1 TF2 Key for Our ${CONFIG.Rates.SELL.TF2_To_Gems} Gems\r\n1 CS:GO Key for Our ${CONFIG.Rates.SELL.CSGO_To_Gems} Gems \r\n\r\nBuy Our: \r\n1 TF2 Key for Your ${CONFIG.Rates.BUY.Gems_To_TF2_Rate} Gems\r\n1 CS:GO Key for Your ${CONFIG.Rates.BUY.Gems_To_CSGO_Rate} Gems\r\n\r\nWe're also:\r\nBuying Your Backgrounds & emotes for ${CONFIG.Rates.BUY.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\nSelling any of OUR Backgrounds & emotes for ${CONFIG.Rates.SELL.BG_And_Emotes} Gems (Send offer & add correct number of my gems for auto accept.)\r\n\r\nKey Swap Rates:\r\nYour ${CONFIG.Rates.Key_Swaps.TF2_To_CS[1]} CS:GO Keys for our ${CONFIG.Rates.Key_Swaps.TF2_To_CS[0]} TF2 Keys -> Use !SwapCS\r\nYour ${CONFIG.Rates.Key_Swaps.CS_To_TF2[1]} TF2 Keys for our ${CONFIG.Rates.Key_Swaps.CS_To_TF2[0]} CS:GO Keys -> Use !SwapTF`,
        );
      } else if (MSG.toUpperCase() == '!INFO') {
        client.chatMessage(
          SENDER,
          'Coded By: https://steamcommunity.com/id/mfwBan/',
        );
      } else if (MSG.toUpperCase() === '!CHECK') {
        let theirTF2 = 0;
        let theirGems;
        manager.getUserInventoryContents(
          SENDER.getSteamID64(),
          440,
          2,
          true,
          (ERR, INV) => {
            if (ERR) {
              console.log(ERR);
            } else {
              for (let i = 0; i < INV.length; i += 1) {
                if (CONFIG.TF2_Keys.indexOf(INV[i].market_hash_name) >= 0) {
                  theirTF2 += 1;
                }
              }
            }
            manager.getUserInventoryContents(
              SENDER.getSteamID64(),
              753,
              6,
              true,
              (ERR3, INV3) => {
                if (ERR3) {
                  console.log(ERR);
                } else {
                  const TheirGems = INV3.filter((gem) => gem.name == 'Gems');
                  if (TheirGems === undefined || TheirGems.length == 0) {
                    theirGems = 0;
                  } else {
                    const gem = TheirGems[0];
                    theirGems = gem.amount;
                  }
                  let TF2_Msg = '';
                  let Gems_Msg = '';
                  if (theirTF2 > 0) {
                    TF2_Msg = `- I can give you ${
                      theirTF2 * CONFIG.Rates.SELL.TF2_To_Gems
                      } Gems for them (Use !SellTF ${theirTF2})`;
                  }
                  if (
                    Math.floor(theirGems / CONFIG.Rates.BUY.Gems_To_TF2_Rate)
                    > 0
                  ) {
                    Gems_Msg = `- I can give you ${Math.floor(
                      theirGems / CONFIG.Rates.BUY.Gems_To_TF2_Rate,
                    )} TF2 Keys for Your ${
                      Math.floor(
                        theirGems / CONFIG.Rates.BUY.Gems_To_TF2_Rate,
                      ) * CONFIG.Rates.BUY.Gems_To_TF2_Rate
                      } Gems (Use !BuyTF ${Math.floor(
                        theirGems / CONFIG.Rates.BUY.Gems_To_TF2_Rate,
                      )})`;
                  }
                  client.chatMessage(
                    SENDER,
                    `You have:\r\n\r\n${theirTF2}TF2 Keys\r\n${TF2_Msg} You have this many Gems ${theirGems} Gems ${Gems_Msg}`,
                  );
                }
              },
            );
          },
        );
      } else if (MSG.toUpperCase().indexOf('!SELLCS') >= 0) {
        let n = MSG.toUpperCase().replace('!SELLCS ', '');
        const Amount_of_Gems = parseInt(n, 10) * CONFIG.Rates.SELL.CSGO_To_Gems;
        const TheirKeys = [];
        if (!isNaN(n) && parseInt(n, 10) > 0) {
          if (n <= CONFIG.Restrictions.MaxSell) {
            const t = manager.createOffer(SENDER.getSteamID64());
            t.getUserDetails((ERR, ME, THEM) => {
              if (ERR) {
                console.log(
                  `## An error occurred while getting trade holds : ${ERR}`,
                );
                client.chatMessage(
                  SENDER,
                  'An error occurred while getting your trade holds. Please Enable your Steam Guard!',
                );
              } else if (ME.escrowDays == 0 && THEM.escrowDays == 0) {
                n = parseInt(n, 10);
                client.chatMessage(
                  SENDER,
                  `You Requested To Sell Your ${n} CS:GO Keys for My ${Amount_of_Gems} Gems`,
                );
                sleep(1500);
                client.chatMessage(SENDER, 'AI initiating...');
                sleep(1500);
                client.chatMessage(SENDER, 'Trade Processing');
                sleep(1500);
                client.chatMessage(SENDER, 'Please hold...');
                sleep(1500);
                manager.getInventoryContents(753, 6, true, (ERR, MyInv) => {
                  if (err) {
                    client.chatMessage(
                      SENDER,
                      'Inventory refresh in session. Try again shortly please.',
                    );
                    return console.log(`[${getTime()}] ${err}`);
                  }
                  const MyGems = MyInv.filter((gem) => gem.name == 'Gems');
                  if (MyGems === undefined || MyGems.length == 0) {
                    client.chatMessage(
                      SENDER,
                      `Sorry, I don't have enough Gems to make this trade: 0 / ${Amount_of_Gems}, I'll restock soon!`,
                    );
                  } else {
                    const gem = MyGems[0];
                    const gemDifference = Amount_of_Gems - gem.amount;
                    if (gemDifference <= 0) {
                      gem.amount = Amount_of_Gems;
                      t.addMyItem(gem);
                      ///
                      manager.getUserInventoryContents(
                        SENDER.getSteamID64(),
                        730,
                        2,
                        true,
                        (ERR2, Inv) => {
                          if (ERR2) {
                            return console.log(ERR2);
                          }
                          ///
                          for (let i = 0; i < Inv.length; i += 1) {
                            if (
                              TheirKeys.length < n
                              && CONFIG.CSGO_Keys.indexOf(
                                Inv[i].market_hash_name,
                              ) >= 0
                            ) {
                              TheirKeys.push(Inv[i]);
                            }
                          }
                          if (TheirKeys.length != n) {
                            if (TheirKeys.length > 0) {
                              /* error */
                              client.chatMessage(
                                SENDER,
                                `You don't have enough CS:GO keys to make this trade: ${TheirKeys.length} / ${n}\r\n Tip: Try using !SellCS ${TheirKeys.length}`,
                              );
                            } else {
                              /* error */
                              client.chatMessage(
                                SENDER,
                                `You don't have enough CS:GO keys to make this trade: ${TheirKeys.length} / ${n}`,
                              );
                            }
                          } else {
                            t.addTheirItems(TheirKeys);
                            t.setMessage('Your Gems Are Ready! Enjoy :)');
                            t.send((ERR) => {
                              if (ERR) {
                                client.chatMessage(
                                  SENDER,
                                  'Inventory refresh in session. Try again shortly please.',
                                );
                                console.log(
                                  `## An error occurred while sending trade: ${ERR}`,
                                );
                              } else {
                                console.log(
                                  `[${getTime()}] [!SellCS] Trade Offer Sent!`,
                                );
                              }
                            });
                          }
                          /// //
                        },
                      );
                    } else if (
                      Math.floor(gem.amount / CONFIG.Rates.SELL.TF2_To_Gems) > 0
                    ) {
                      client.chatMessage(
                        SENDER,
                        `Sorry, I don't have enough Gems to make this trade: ${
                        gem.amount
                        } / ${Amount_of_Gems}\r\nTip: Try using !SellCS ${Math.floor(
                          gem.amount / CONFIG.Rates.SELL.TF2_To_Gems,
                        )}`,
                      );
                    } else {
                      client.chatMessage(
                        SENDER,
                        `Sorry, I don't have enough Gems to make this trade: ${gem.amount} / ${Amount_of_Gems}, I'll restock soon!`,
                      );
                    }
                  }
                });
              } else {
                client.chatMessage(
                  SENDER,
                  'Make sure you do not have any Trade Holds.',
                );
              }
            });
          } else {
            client.chatMessage(
              SENDER,
              `You can only Sell up to ${CONFIG.Restrictions.MaxSell} CS:GO Keys to me at a time!`,
            );
          }
        } else {
          client.chatMessage(
            SENDER,
            'Please provide a valid amount of Keys -> !SellCS [Number of Keys]',
          );
        }
      } else if (MSG.toUpperCase().indexOf('!SWAPTF') >= 0) {
        let n = MSG.toUpperCase().replace('!SWAPTF ', '');
        const My_CSGO = Math.floor(
          (parseInt(n, 10) / CONFIG.Rates.Key_Swaps.CS_To_TF2[1])
          * CONFIG.Rates.Key_Swaps.CS_To_TF2[0],
        );
        const TheirKeys = [];
        const MyKeys = [];
        if (!isNaN(n) && parseInt(n, 10) > 0) {
          if (n <= CONFIG.Rates.Key_Swaps.Max_Swap) {
            const t = manager.createOffer(SENDER.getSteamID64());
            t.getUserDetails((ERR, ME, THEM) => {
              if (ERR) {
                console.log(
                  `## An error occurred while getting trade holds: ${ERR}`,
                );
                client.chatMessage(
                  SENDER,
                  'An error occurred while getting your trade holds. Please Enable your Steam Guard!',
                );
              } else if (ME.escrowDays == 0 && THEM.escrowDays == 0) {
                n = parseInt(n, 10);
                client.chatMessage(
                  SENDER,
                  `You Requested To Swap Your ${n} TF2 Keys for My ${My_CSGO} CS:GO Keys (${CONFIG.Rates.Key_Swaps.CS_To_TF2[1]} / ${CONFIG.Rates.Key_Swaps.CS_To_TF2[0]}) Rate`,
                );
                sleep(1500);
                client.chatMessage(SENDER, 'AI initiating...');
                sleep(1500);
                client.chatMessage(SENDER, 'Trade Processing');
                sleep(1500);
                client.chatMessage(SENDER, 'Please hold...');
                sleep(1500);
                manager.getUserInventoryContents(
                  SENDER.getSteamID64(),
                  440,
                  2,
                  true,
                  (ERR, INV) => {
                    if (ERR) {
                      console.log(
                        `## An unforseen error occurred while getting inventory: ${ERR}`,
                      );
                      client.chatMessage(
                        SENDER,
                        'An error occurred while loading your inventory. Is it private?',
                      );
                    } else {
                      for (let i = 0; i < INV.length; i += 1) {
                        if (
                          TheirKeys.length < n
                          && CONFIG.TF2_Keys.indexOf(INV[i].market_hash_name) >= 0
                        ) {
                          TheirKeys.push(INV[i]);
                        }
                      }
                      if (TheirKeys.length != n) {
                        client.chatMessage(
                          SENDER,
                          `You don't have enough TF2 Keys: ${TheirKeys.length} / ${n} or they're not Tradeable Yet`,
                        );
                        console.log(
                          `[SwapTF] Not enough Keys:${TheirKeys.length} / ${n}`,
                        );
                      } else {
                        t.addTheirItems(TheirKeys);
                        manager.getInventoryContents(
                          730,
                          2,
                          true,
                          (ERR2, MyInv) => {
                            if (ERR2) {
                              return console.log(ERR2);
                            }
                            ///
                            for (let i = 0; i < MyInv.length; i += 1) {
                              if (
                                MyKeys.length < My_CSGO
                                && CONFIG.CSGO_Keys.indexOf(
                                  MyInv[i].market_hash_name,
                                ) >= 0
                              ) {
                                MyKeys.push(MyInv[i]);
                              }
                            }
                            if (MyKeys.length != My_CSGO) {
                              if (MyKeys.length > 0) {
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough CS:GO keys to make this trade: ${
                                  MyKeys.length
                                  } / ${My_CSGO}\r\nTip: Try using !SwapTF ${Math.floor(
                                    (MyKeys.length
                                      / CONFIG.Rates.Key_Swaps.CS_To_TF2[0])
                                    * CONFIG.Rates.Key_Swaps.CS_To_TF2[1],
                                  )}`,
                                );
                              } else {
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough CS:GO keys to make this trade: ${MyKeys.length} / ${My_CSGO}, I'll restock soon!`,
                                );
                              }
                            } else {
                              t.addMyItems(MyKeys);
                              t.setMessage(
                                `Your ${TheirKeys.length} TF2 Keys for My ${MyKeys.length} CS:GO Keys,Enjoy :) (!SwapTF)`,
                              );
                              t.send((ERR) => {
                                if (ERR) {
                                  client.chatMessage(
                                    SENDER,
                                    'Inventory refresh in session. Try again shortly please.',
                                  );
                                  console.log(
                                    `## An unforseen error occurred while sending trade: ${ERR}`,
                                  );
                                } else {
                                  console.log(
                                    `[${getTime()}] [!SwapTF] Trade Offer Sent!`,
                                  );
                                }
                              });
                            }
                          },
                        );
                      }
                    }
                  },
                );
              } else {
                client.chatMessage(
                  SENDER,
                  'Make sure you do not have any Trade Holds.',
                );
              }
            });
          } else {
            client.chatMessage(
              SENDER,
              `You can only Swap up to ${CONFIG.Rates.Key_Swaps.Max_Swap} Keys at a time!`,
            );
          }
        } else {
          client.chatMessage(
            SENDER,
            'Please provide a valid amount of Keys -> !SwapTF [Number of your TF2 Keys]\r\nFor Example: !SwapTF 10',
          );
        }
      } else if (MSG.toUpperCase().indexOf('!SWAPCS') >= 0) {
        let n = MSG.toUpperCase().replace('!SWAPCS ', '');
        const My_TF2 = Math.floor(
          (parseInt(n, 10) / CONFIG.Rates.Key_Swaps.TF2_To_CS[1])
          * CONFIG.Rates.Key_Swaps.TF2_To_CS[0],
        );
        const TheirKeys = [];
        const MyKeys = [];
        if (!isNaN(n) && parseInt(n, 10) > 0) {
          if (n <= CONFIG.Rates.Key_Swaps.Max_Swap) {
            const t = manager.createOffer(SENDER.getSteamID64());
            t.getUserDetails((ERR, ME, THEM) => {
              if (ERR) {
                console.log(
                  `## An error occurred while getting trade holds: ${ERR}`,
                );
                client.chatMessage(
                  SENDER,
                  'An error occurred while getting your trade holds. Please Enable your Steam Guard!',
                );
              } else if (ME.escrowDays == 0 && THEM.escrowDays == 0) {
                n = parseInt(n, 10);
                client.chatMessage(
                  SENDER,
                  `You Requested To Swap Your ${n} CS:GO Keys for My ${My_TF2} TF2 Keys (${CONFIG.Rates.Key_Swaps.TF2_To_CS[1]} / ${CONFIG.Rates.Key_Swaps.TF2_To_CS[0]}) Rate`,
                );
                sleep(1500);
                client.chatMessage(SENDER, 'AI initiating...');
                sleep(1500);
                client.chatMessage(SENDER, 'Trade Processing');
                sleep(1500);
                client.chatMessage(SENDER, 'Please hold...');
                sleep(1500);
                manager.getUserInventoryContents(
                  SENDER.getSteamID64(),
                  730,
                  2,
                  true,
                  (ERR, INV) => {
                    if (ERR) {
                      console.log(
                        `## An error occurred while getting inventory: ${ERR}`,
                      );
                      client.chatMessage(
                        SENDER,
                        'An error occurred while loading your inventory. Is it private?',
                      );
                    } else {
                      for (let i = 0; i < INV.length; i += 1) {
                        if (
                          TheirKeys.length < n
                          && CONFIG.CSGO_Keys.indexOf(INV[i].market_hash_name) >= 0
                        ) {
                          TheirKeys.push(INV[i]);
                        }
                      }
                      if (TheirKeys.length != n) {
                        client.chatMessage(
                          SENDER,
                          `You don't have enough CS:GO Keys: ${TheirKeys.length} / ${n} or they're not Tradeable Yet`,
                        );
                        console.log(
                          `[SwapCS] Not enough Keys:${TheirKeys.length} / ${n}`,
                        );
                      } else {
                        t.addTheirItems(TheirKeys);
                        manager.getInventoryContents(
                          440,
                          2,
                          true,
                          (ERR2, MyInv) => {
                            if (ERR2) {
                              return console.log(ERR2);
                            }
                            ///
                            for (let i = 0; i < MyInv.length; i += 1) {
                              if (
                                MyKeys.length < My_TF2
                                && CONFIG.TF2_Keys.indexOf(
                                  MyInv[i].market_hash_name,
                                ) >= 0
                              ) {
                                MyKeys.push(MyInv[i]);
                              }
                            }
                            if (MyKeys.length != My_TF2) {
                              if (MyKeys.length > 0) {
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough TF2 keys to make this trade: ${
                                  MyKeys.length
                                  } / ${My_TF2}\r\nTip: Try using !SwapCS ${Math.floor(
                                    (MyKeys.length
                                      / CONFIG.Rates.Key_Swaps.TF2_To_CS[0])
                                    * CONFIG.Rates.Key_Swaps.TF2_To_CS[1],
                                  )}`,
                                );
                              } else {
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough TF2 keys to make this trade: ${MyKeys.length} / ${My_TF2}, I'll restock soon!`,
                                );
                              }
                            } else {
                              t.addMyItems(MyKeys);
                              t.setMessage(
                                `Your ${TheirKeys.length} CS:GO Keys for My ${MyKeys.length} TF2 Keys,Enjoy :) (!SwapCS)`,
                              );
                              t.send((ERR) => {
                                if (ERR) {
                                  client.chatMessage(
                                    SENDER,
                                    'Inventory refresh in session. Try again shortly please.',
                                  );
                                  console.log(
                                    `## An error occurred while sending trade: ${ERR}`,
                                  );
                                } else {
                                  console.log(
                                    `[${getTime()}] [!SwapCS] Trade Offer Sent!`,
                                  );
                                }
                              });
                            }
                            /// //
                          },
                        );
                      }
                    }
                  },
                );
              } else {
                client.chatMessage(
                  SENDER,
                  'Make sure you do not have any Trade Holds.',
                );
              }
            });
          } else {
            client.chatMessage(
              SENDER,
              `You can only Swap up to ${CONFIG.Rates.Key_Swaps.Max_Swap} Keys at a time!`,
            );
          }
        } else {
          client.chatMessage(
            SENDER,
            'Please provide a valid amount of Keys -> !SwapCS [Number of your CSGO Keys]\r\nFor Example: !SwapCS 10',
          );
        }
      } else if (MSG.toUpperCase().indexOf('!BUYTF') >= 0) {
        const n = MSG.toUpperCase().replace('!BUYTF ', '');
        const Amount_of_Gems = parseInt(n, 10) * CONFIG.Rates.BUY.Gems_To_TF2_Rate;
        const MyKeys = [];
        if (!isNaN(n) && parseInt(n, 10) > 0) {
          if (n <= CONFIG.Restrictions.MaxBuy) {
            const t = manager.createOffer(SENDER.getSteamID64());
            t.getUserDetails((ERR, ME, THEM) => {
              if (ERR) {
                console.log(
                  `## An error occurred while getting trade holds: ${ERR}`,
                );
                client.chatMessage(
                  SENDER,
                  'An error occurred while getting your trade holds. Please Enable your Steam Guard!',
                );
              } else if (ME.escrowDays == 0 && THEM.escrowDays == 0) {
                client.chatMessage(
                  SENDER,
                  `You Requested To Buy My ${n} TF2 Keys for your ${Amount_of_Gems} Gems`,
                );
                sleep(1500);
                client.chatMessage(SENDER, 'AI initiating...');
                sleep(1500);
                client.chatMessage(SENDER, 'Trade Processing');
                sleep(1500);
                client.chatMessage(SENDER, 'Please hold...');
                sleep(1500);
                manager.getUserInventoryContents(
                  SENDER.getSteamID64(),
                  753,
                  6,
                  true,
                  (ERR, INV) => {
                    if (err) {
                      return console.log(`[${getTime()}] ${err}`);
                      client.chatMessage(
                        SENDER,
                        "I can't load your Steam Inventory. Is it private? \r\n If it's not private, then please try again in a few seconds.",
                      );
                    }
                    const TheirGems = INV.filter((gem) => gem.name == 'Gems');
                    if (typeof TheirGems[0] === 'undefined') {
                      client.chatMessage(
                        SENDER,
                        `You don't have enough Gems to make this trade: 0 / ${Amount_of_Gems}`,
                      );
                    } else {
                      const gem = TheirGems[0];
                      const gemDifference = Amount_of_Gems - gem.amount;
                      if (gemDifference <= 0) {
                        gem.amount = Amount_of_Gems;
                        t.addTheirItem(gem);
                        manager.getInventoryContents(
                          440,
                          2,
                          true,
                          (ERR2, MyInv) => {
                            if (ERR2) {
                              return console.log(ERR2);
                            }
                            ///
                            for (let i = 0; i < MyInv.length; i += 1) {
                              if (
                                MyKeys.length < n
                                && CONFIG.TF2_Keys.indexOf(
                                  MyInv[i].market_hash_name,
                                ) >= 0
                              ) {
                                MyKeys.push(MyInv[i]);
                              }
                            }
                            if (MyKeys.length != n) {
                              if (MyKeys.length > 0) {
                                /* error */
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough TF2 keys to make this trade: ${MyKeys.length} / ${n}\r\nTip: Try using !BuyTF ${MyKeys.length}`,
                                );
                              } else {
                                /* error */
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough TF2 keys to make this trade: ${MyKeys.length} / ${n}, I'll restock soon!`,
                                );
                              }
                            } else {
                              t.addMyItems(MyKeys);
                              t.setMessage('Enjoy your TF2 Keys :)');
                              t.send((ERR) => {
                                if (ERR) {
                                  client.chatMessage(
                                    SENDER,
                                    'Inventory refresh in session. Try again shortly please.',
                                  );
                                  console.log(
                                    `## An error occurred while sending trade: ${ERR}`,
                                  );
                                } else {
                                  console.log(
                                    `[${getTime()}] [!BuyTF] Trade Offer Sent!`,
                                  );
                                }
                              });
                            }
                          },
                        );
                      } else if (
                        Math.floor(
                          gem.amount / CONFIG.Rates.BUY.Gems_To_TF2_Rate,
                        ) > 0
                      ) {
                        client.chatMessage(
                          SENDER,
                          `You don't have enough Gems to make this trade: ${
                          gem.amount
                          } / ${Amount_of_Gems}\r\nTip: Try using !BuyTF ${Math.floor(
                            gem.amount / CONFIG.Rates.BUY.Gems_To_TF2_Rate,
                          )}`,
                        );
                      } else {
                        client.chatMessage(
                          SENDER,
                          `You don't have enough Gems to make this trade: ${gem.amount} / ${Amount_of_Gems}`,
                        );
                      }
                    }
                  },
                );
              } else {
                client.chatMessage(
                  SENDER,
                  'Make sure you do not have any Trade Holds.',
                );
              }
            });
          } else {
            client.chatMessage(
              SENDER,
              `You can only buy up to ${CONFIG.Restrictions.MaxBuy} TF2 Keys From me at a time!`,
            );
          }
        } else {
          client.chatMessage(
            SENDER,
            'Please provide a valid amount of Keys -> !BuyTF [Number of Keys]',
          );
        }
      } else if (MSG.toUpperCase().indexOf('!BUYCS') >= 0) {
        let n = MSG.toUpperCase().replace('!BUYCS ', '');
        const Amount_of_Gems = parseInt(n, 10) * CONFIG.Rates.BUY.Gems_To_CSGO_Rate;
        const MyKeys = [];
        if (!isNaN(n) && parseInt(n, 10) > 0) {
          if (n <= CONFIG.Restrictions.MaxBuy) {
            const t = manager.createOffer(SENDER.getSteamID64());
            t.getUserDetails((ERR, ME, THEM) => {
              if (ERR) {
                console.log(
                  `## An error occurred while getting trade holds: ${ERR}`,
                );
                client.chatMessage(
                  SENDER,
                  'An error occurred while getting your trade holds. Please Enable your Steam Guard!',
                );
              } else if (ME.escrowDays == 0 && THEM.escrowDays == 0) {
                n = parseInt(n, 10);
                client.chatMessage(
                  SENDER,
                  `You Requested To Buy My ${n} CS:GO Keys for your ${Amount_of_Gems} Gems`,
                );
                sleep(1500);
                client.chatMessage(SENDER, 'AI initiating...');
                sleep(1500);
                client.chatMessage(SENDER, 'Trade Processing');
                sleep(1500);
                client.chatMessage(SENDER, 'Please hold...');
                sleep(1500);
                manager.getUserInventoryContents(
                  SENDER.getSteamID64(),
                  753,
                  6,
                  true,
                  (ERR, INV) => {
                    if (err) {
                      return console.log(`[${getTime()}] ${err}`);
                      client.chatMessage(
                        SENDER,
                        "I can't load your Steam Inventory. Is it private? \r\n If it's not private, then please try again in a few seconds.",
                      );
                    }
                    const TheirGems = INV.filter((gem) => gem.name == 'Gems');
                    ///
                    if (typeof TheirGems[0] === 'undefined') {
                      client.chatMessage(
                        SENDER,
                        `You don't have enough Gems to make this trade: 0 / ${Amount_of_Gems}`,
                      );
                    }
                    ///
                    else {
                      const gem = TheirGems[0];
                      const gemDifference = Amount_of_Gems - gem.amount;
                      if (gemDifference <= 0) {
                        gem.amount = Amount_of_Gems;
                        t.addTheirItem(gem);
                        manager.getInventoryContents(
                          730,
                          2,
                          true,
                          (ERR2, MyInv) => {
                            if (ERR2) {
                              return console.log(ERR2);
                            }
                            ///
                            for (let i = 0; i < MyInv.length; i += 1) {
                              if (
                                MyKeys.length < n
                                && CONFIG.CSGO_Keys.indexOf(
                                  MyInv[i].market_hash_name,
                                ) >= 0
                              ) {
                                MyKeys.push(MyInv[i]);
                              }
                            }
                            if (MyKeys.length != n) {
                              if (MyKeys.length > 0) {
                                /* error */
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough CS:GO keys to make this trade: ${MyKeys.length} / ${n}\r\nTip: Try using !BuyCS ${MyKeys.length}`,
                                );
                              } else {
                                /* error */
                                client.chatMessage(
                                  SENDER,
                                  `Sorry, I don't have enough CS:GO keys to make this trade: ${MyKeys.length} / ${n}, I'll restock soon!`,
                                );
                              }
                            } else {
                              t.addMyItems(MyKeys);
                              t.setMessage('Enjoy your CS:GO Keys :)');
                              t.send((ERR) => {
                                if (ERR) {
                                  client.chatMessage(
                                    SENDER,
                                    'Inventory refresh in session. Try again shortly please.',
                                  );
                                  console.log(
                                    `## An error occurred while sending trade: ${ERR}`,
                                  );
                                } else {
                                  console.log(
                                    `[${getTime()}] [!BuyCS] Trade Offer Sent!`,
                                  );
                                }
                              });
                            }
                            /// //
                          },
                        );
                      } else if (
                        Math.floor(
                          gem.amount / CONFIG.Rates.BUY.Gems_To_CSGO_Rate,
                        ) > 0
                      ) {
                        client.chatMessage(
                          SENDER,
                          `You don't have enough Gems to make this trade: ${
                          gem.amount
                          } / ${Amount_of_Gems}\r\nTip: Try using !BuyCS ${Math.floor(
                            gem.amount / CONFIG.Rates.BUY.Gems_To_CSGO_Rate,
                          )}`,
                        );
                      } else {
                        client.chatMessage(
                          SENDER,
                          `You don't have enough Gems to make this trade: ${gem.amount} / ${Amount_of_Gems}`,
                        );
                      }
                    }
                  },
                );
              } else {
                client.chatMessage(
                  SENDER,
                  'Make sure you do not have any Trade Holds.',
                );
              }
            });
          } else {
            client.chatMessage(
              SENDER,
              `You can only buy up to ${CONFIG.Restrictions.MaxBuy} CSGO Keys From me at a time!`,
            );
          }
        } else {
          client.chatMessage(
            SENDER,
            'Please provide a valid amount of Keys -> !BuyCS [Number of Keys]',
          );
        }
      } else if (MSG.toUpperCase().indexOf('!SELLTF') >= 0) {
        let n = MSG.toUpperCase().replace('!SELLTF ', '');
        const Amount_of_Gems = parseInt(n, 10) * CONFIG.Rates.SELL.TF2_To_Gems;
        const TheirKeys = [];
        if (!isNaN(n) && parseInt(n, 10) > 0) {
          if (n <= CONFIG.Restrictions.MaxSell) {
            const t = manager.createOffer(SENDER.getSteamID64());
            t.getUserDetails((ERR, ME, THEM) => {
              if (ERR) {
                console.log(
                  `## An error occurred while getting trade holds: ${ERR}`,
                );
                client.chatMessage(
                  SENDER,
                  'An error occurred while getting your trade holds. Please Enable your Steam Guard!',
                );
              } else if (ME.escrowDays == 0 && THEM.escrowDays == 0) {
                n = parseInt(n, 10);
                client.chatMessage(
                  SENDER,
                  `You Requested To Sell Your ${n} TF2 Keys for My ${Amount_of_Gems} Gems`,
                );
                sleep(1500);
                client.chatMessage(SENDER, 'AI initiating...');
                sleep(1500);
                client.chatMessage(SENDER, 'Trade Processing');
                sleep(1500);
                client.chatMessage(SENDER, 'Please hold...');
                sleep(1500);
                manager.getInventoryContents(753, 6, true, (ERR, MyInv) => {
                  if (err) {
                    client.chatMessage(
                      SENDER,
                      'Inventory refresh in session. Try again shortly please.',
                    );
                    return console.log(`[${getTime()}] ${err}`);
                  }
                  const MyGems = MyInv.filter((gem) => gem.name == 'Gems');
                  if (MyGems === undefined || MyGems.length == 0) {
                    client.chatMessage(
                      SENDER,
                      `Sorry, I don't have enough Gems to make this trade: 0 / ${Amount_of_Gems}, I'll restock soon!`,
                    );
                  } else {
                    const gem = MyGems[0];
                    const gemDifference = Amount_of_Gems - gem.amount;
                    if (gemDifference <= 0) {
                      gem.amount = Amount_of_Gems;
                      t.addMyItem(gem);
                      ///
                      manager.getUserInventoryContents(
                        SENDER.getSteamID64(),
                        440,
                        2,
                        true,
                        (ERR2, Inv) => {
                          if (ERR2) {
                            return console.log(ERR2);
                          }
                          ///
                          for (let i = 0; i < Inv.length; i += 1) {
                            if (
                              TheirKeys.length < n
                              && CONFIG.TF2_Keys.indexOf(
                                Inv[i].market_hash_name,
                              ) >= 0
                            ) {
                              TheirKeys.push(Inv[i]);
                            }
                          }
                          if (TheirKeys.length != n) {
                            if (TheirKeys.length > 0) {
                              /* error */
                              client.chatMessage(
                                SENDER,
                                `You don't have enough TF2 keys to make this trade: ${TheirKeys.length} / ${n}\r\nTip: Try using !SellTF ${TheirKeys.length}`,
                              );
                            } else {
                              /* error */
                              client.chatMessage(
                                SENDER,
                                `You don't have enough TF2 keys to make this trade: ${TheirKeys.length} / ${n}`,
                              );
                            }
                          } else {
                            t.addTheirItems(TheirKeys);
                            t.setMessage('Enjoy your Gems! Have a good day :)');
                            t.send((ERR) => {
                              if (ERR) {
                                client.chatMessage(
                                  SENDER,
                                  'Inventory refresh in session. Try again shortly please.',
                                );
                                console.log(
                                  `## An error occurred while sending trade : ${ERR}`,
                                );
                              } else {
                                console.log(
                                  `[${getTime()}] [!SellTF] Trade Offer Sent!`,
                                );
                              }
                            });
                          }
                        },
                      );
                    } else if (
                      Math.floor(gem.amount / CONFIG.Rates.SELL.TF2_To_Gems) > 0
                    ) {
                      client.chatMessage(
                        SENDER,
                        `Sorry, I don't have enough Gems to make this trade: ${
                        gem.amount
                        } / ${Amount_of_Gems}\r\nTip: Try using !SellTF ${Math.floor(
                          gem.amount / CONFIG.Rates.SELL.TF2_To_Gems,
                        )}`,
                      );
                    } else {
                      client.chatMessage(
                        SENDER,
                        `Sorry, I don't have enough Gems to make this trade: ${gem.amount} / ${Amount_of_Gems}, I'll restock soon!`,
                      );
                    }
                  }
                });
              } else {
                client.chatMessage(
                  SENDER,
                  'Make sure you do not have any Trade Holds.',
                );
              }
            });
          } else {
            client.chatMessage(
              SENDER,
              `You can only Sell up to ${CONFIG.Restrictions.MaxSell} TF2 Keys to me at a time!`,
            );
          }
        } else {
          client.chatMessage(
            SENDER,
            'Please provide a valid amount of Keys -> !SellTF [Number of Keys]',
          );
        }
      } else if (
        CONFIG.Owner.indexOf(SENDER.getSteamID64()) >= 0
        || CONFIG.Owner.indexOf(parseInt(SENDER.getSteamID64(), 10)) >= 0
      ) {
        if (MSG.toUpperCase().indexOf('!BLOCK') >= 0) {
          // !block
          const n = MSG.toUpperCase().replace('!BLOCK ', '').toString();
          if (SID64REGEX.test(n)) {
            client.chatMessage(SENDER, 'User blocked and unfriended.');
            client.removeFriend(n);
            client.blockUser(n);
          } else {
            client.chatMessage(
              SENDER,
              '[Error]  Please provide a valid SteamID64',
            );
          }
        } else if (MSG.toUpperCase().indexOf('!ADMIN') >= 0) {
          client.chatMessage(SENDER, CONFIG.MESSAGES.ADMINHELP);
        } else if (MSG.toUpperCase().indexOf('!PROFIT') >= 0) {
          sleep(2000);
          const Database = JSON.parse(
            fs
              .readFileSync('./SETTINGS/TotalSold.json')
              .toString('utf8'),
          );
          const Bought = Database.Profit.Buy;
          const Sold = Database.Profit.Sell;
          const Swapped = Database.Profit.Swap;
          const total_Bought = Bought.TF2[1] + Bought.CSGO[1] + Bought.CRAP[1]; // weekly total profits
          const total_Sold = Sold.TF2[1] + Sold.CSGO[1] + Sold.CRAP[1]; // weekly total sets sold
          const total_Bought2 = Bought.TF2[0] + Bought.CSGO[0] + Bought.CRAP[0]; // lifetime total profits
          const total_Sold2 = Sold.TF2[0] + Sold.CSGO[0] + Sold.CRAP[0]; // lifetime total sold
          let content = "-------------------------------\r\nYour Bot's Activity Today:\r\n\r\n";
          content += `- Profited ${total_Bought} Gems from Buy Features\r\n- Profited ${total_Sold} Gems from Sell Features\r\n\r\nActivity since the start:\r\n\r\n- Profited ${total_Bought2} Gems from Buy Features\r\n- Profited ${total_Sold2} Gems from Sell Features\r\n-------------------------------\r\n\r\n ↧↧↧\r\n\r\n[Buy Features Activity Today ★] \r\n-------------------------------\r\n✔ ${Bought.TF2[1]} Gems Profit ► !BuyTF  |  ( ► Lifetime Profit: ${Bought.TF2[0]} Gems)\r\n✔ ${Bought.CSGO[1]} Gems Profit ► !BuyCS  |  ( ► Lifetime Profit: ${Bought.CSGO[0]} Gems)\r\n✔ ${Bought.CRAP[1]} Gems Profit ► (BG/Emote Trades)  |  ( ► Lifetime Profit: ${Bought.CRAP[0]} Gems)`;
          content += '\r\n\r\n\r\n';
          content += `[Sell Commands Activity Today ★]\r\n-------------------------------\r\n✔ ${Sold.TF2[1]} Gems Profit ► !SellTF  |  ( ► Lifetime Profit: ${Sold.TF2[0]} Gems)\r\n✔ ${Sold.CSGO[1]} Gems Profit ► !SellCS  |  ( ► Lifetime Profit: ${Sold.CSGO[0]} Gems)\r\n✔ ${Sold.CRAP[1]} Gems Profit ► (BG/EMOTE Trades)  |  ( ► Lifetime Profit: ${Sold.CRAP[0]} Gems)\r\n\r\n`;
          content += `[Swap Features Activity Today★]\r\n-------------------------------\r\n[!SwapTF]\r\n\r\n✔ Swapped my ${Swapped.TF2[1][0]} CS:GO Keys for their ${Swapped.TF2[1][1]} TF2 Keys \r\n( ► Lifetime Swaps:  My ${Swapped.TF2[0][0]} CS:GO Keys for their ${Swapped.TF2[0][1]} TF2 Keys)\r\n\r\n[!SwapCS]\r\n\r\n✔ Swapped my ${Swapped.CSGO[1][0]} TF2 Keys for their ${Swapped.CSGO[1][1]} CS:GO Keys \r\n( ► Lifetime Swaps:  My ${Swapped.CSGO[0][0]} TF2 Keys for their ${Swapped.CSGO[0][1]} CS:GO Keys)`;
          client.chatMessage(SENDER, content);
        } else if (MSG.toUpperCase() == '!BROADCAST') {
          for (const SteamID in client.myFriends) {
            const relationship = client.myFriends[SteamID];
            if (relationship == SteamUser.EFriendRelationship.Friend) {
              client.chatMessage(SteamID, CONFIG.MESSAGES.BROADCAST);
              sleep(10000);
            }
          }
        } else if (MSG.toUpperCase().indexOf('!UNBLOCK') >= 0) {
          const n = MSG.toUpperCase().replace('!UNBLOCK ', '').toString();
          if (SID64REGEX.test(n)) {
            client.chatMessage(SENDER, 'User UnBlocked + Friended');
            client.unblockUser(n);
            sleep(2000);
            client.addFriend(n, (err, name) => {
              if (!err) {
                console.log(`User Unblocked + Friended: ${name}`);
              }
            });
          } else {
            client.chatMessage(SENDER, 'Please provide a valid SteamID64');
          }
        } else {
          client.chatMessage(SENDER, '[Error] Admin Command Not Found.');
        }
      } else {
        client.chatMessage(
          SENDER,
          'Command Not Found. Try !help to see our Commands',
        );
      }
    });
  }
});

function RefreshInventory() {
  manager.getInventoryContents(753, 6, true, (ERR, INV) => {
    if (ERR) {
      console.log(`Error Refreshing Inventory : ${ERR}`);
    } else {
      let My_gems = 0;
      const MyGems = INV.filter((gem) => gem.name == 'Gems');
      if (typeof MyGems[0] !== 'undefined') {
        const gem = MyGems[0];
        My_gems = gem.amount;
      }
      const playThis = `${+My_gems} Gems > Buy/Sell Gems (!prices)`;
      client.gamesPlayed(playThis, true);
    }
  });
}

manager.on('sentOfferChanged', (OFFER) => {
  const TradeType = OFFER.message;
  if (OFFER.state == 3) {
    const MyItems = OFFER.itemsToGive.length;
    const TheirItems = OFFER.itemsToReceive.length;
    const Database = JSON.parse(
      fs.readFileSync('./SETTINGS/TotalSold.json').toString('utf8'),
    );
    if (TradeType.includes('!BuyTF')) {
      client.chatMessage(
        OFFER.partner,
        'Trade Complete! Enjoy your Keys and please +rep my profile so others knows I work :) Have a nice day!',
      );
      Comment_User(OFFER.partner);
      client.chatMessage(
        CONFIG.Owner[1],
        `[Profit] Sold my ${MyItems} TF2 Keys for their ${OFFER.itemsToReceive[0].amount} Gems`,
      );
      const Profit = MyItems.length
        * (CONFIG.Rates.BUY.Gems_To_TF2_Rate - CONFIG.Rates.SELL.TF2_To_Gems);
      Database.Profit.Buy.TF2[0] += Profit;
      Database.Profit.Buy.TF2[1] += Profit;
      Database.Profit.Buy.TF2[2] += Profit;
      fs.writeFileSync(
        './SETTINGS/TotalSold.json',
        JSON.stringify(Database, undefined, '\t'),
      );
    } else if (TradeType.includes('!SellTF')) {
      Comment_User(OFFER.partner);
      client.chatMessage(
        OFFER.partner,
        'Trade Complete! Enjoy your Gems and please +rep my profile so others knows I work :) Have a nice day!',
      );
      client.chatMessage(
        CONFIG.Owner[1],
        `[Profit] Bought his ${TheirItems} TF2 Keys for My ${OFFER.itemsToGive[0].amount} Gems`,
      );
      const Profit = TheirItems.length
        * (CONFIG.Rates.BUY.Gems_To_TF2_Rate - CONFIG.Rates.SELL.TF2_To_Gems);
      Database.Profit.Buy.CSGO[0] += Profit;
      Database.Profit.Buy.CSGO[1] += Profit;
      Database.Profit.Buy.CSGO[2] += Profit;
      fs.writeFileSync(
        './SETTINGS/TotalSold.json',
        JSON.stringify(Database, undefined, '\t'),
      );
    } else if (TradeType.includes('!BuyCs')) {
      client.chatMessage(
        OFFER.partner,
        'Trade Complete! Enjoy your Keys and please +rep my profile so others knows I work :) Have a nice day!',
      );
      Comment_User(OFFER.partner);
      client.chatMessage(
        CONFIG.Owner[1],
        `[Profit] Sold my ${MyItems} CS:GO Keys for their ${OFFER.itemsToReceive[0].amount} Gems`,
      );
      const Profit = MyItems.length
        * (CONFIG.Rates.BUY.Gems_To_CSGO_Rate - CONFIG.Rates.SELL.CSGO_To_Gems);
      Database.Profit.Buy.CSGO[0] += Profit;
      Database.Profit.Buy.CSGO[1] += Profit;
      Database.Profit.Buy.CSGO[2] += Profit;
      fs.writeFileSync(
        './SETTINGS/TotalSold.json',
        JSON.stringify(Database, undefined, '\t'),
      );
    } else if (TradeType.includes('!SellCS')) {
      Comment_User(OFFER.partner);
      client.chatMessage(
        OFFER.partner,
        'Trade Complete! Enjoy your Gems and please +rep my profile so others knows I work :) Have a nice day!',
      );
      client.chatMessage(
        CONFIG.Owner[1],
        `[Profit] Bought his ${TheirItems} CS:GO Keys for My ${OFFER.itemsToGive[0].amount} Gems`,
      );
      const Profit = TheirItems.length
        * (CONFIG.Rates.BUY.Gems_To_CSGO_Rate - CONFIG.Rates.SELL.CSGO_To_Gems);
      Database.Profit.Buy.CSGO[0] += Profit;
      Database.Profit.Buy.CSGO[1] += Profit;
      Database.Profit.Buy.CSGO[2] += Profit;
      fs.writeFileSync(
        './SETTINGS/TotalSold.json',
        JSON.stringify(Database, undefined, '\t'),
      );
    } else if (TradeType.includes('!SwapCS')) {
      Comment_User(OFFER.partner);
      client.chatMessage(
        OFFER.partner,
        'Trade Complete! Enjoy your TF2 Keys and please +rep my profile so others knows I work :) Have a nice day!',
      );
      client.chatMessage(
        CONFIG.Owner[1],
        `[Swap] Swapped their ${TheirItems} CS:GO Keys for My ${MyItems} TF2 Keys`,
      );
      Database.Profit.Swap.CSGO[0][0] += MyItems.length;
      Database.Profit.Swap.CSGO[0][1] += TheirItems.length;
      Database.Profit.Swap.CSGO[1][0] += MyItems.length;
      Database.Profit.Swap.CSGO[1][1] += TheirItems.length;
      Database.Profit.Swap.CSGO[2][0] += MyItems.length;
      Database.Profit.Swap.CSGO[2][1] += TheirItems.length;
      fs.writeFileSync(
        './SETTINGS/TotalSold.json',
        JSON.stringify(Database, undefined, '\t'),
      );
    } else if (TradeType.includes('!SwapTF')) {
      Comment_User(OFFER.partner);
      client.chatMessage(
        OFFER.partner,
        'Trade Complete! Enjoy your CSGO and please +rep my profile so others knows I work :) Have a nice day!',
      );
      client.chatMessage(
        CONFIG.Owner[1],
        `[Swap] Swapped their ${TheirItems} TF2 Keys for My ${MyItems} CS:GO Keys`,
      );
      Database.Profit.Swap.TF2[0][0] += MyItems.length;
      Database.Profit.Swap.TF2[0][1] += TheirItems.length;
      Database.Profit.Swap.TF2[1][0] += MyItems.length;
      Database.Profit.Swap.TF2[1][1] += TheirItems.length;
      Database.Profit.Swap.TF2[2][0] += MyItems.length;
      Database.Profit.Swap.TF2[2][1] += TheirItems.length;
      fs.writeFileSync(
        './SETTINGS/TotalSold.json',
        JSON.stringify(Database, undefined, '\t'),
      );
    }
    RefreshInventory();
  }
});

function Comment_User(SteamID) {
  community.getSteamUser(SteamID, (ERR, USER) => {
    if (ERR) {
      console.log(
        `## An error occurred while getting user profile: Usually private. ${ERR}`,
      );
    } else {
      USER.comment(CONFIG.Comment_After_Trade, (ERR) => {
        if (ERR) {
          console.log(
            `## An error occurred while commenting on user profile: comments disabled for any reason. ${ERR}`,
          );
        }
      });
    }
  });
}

function Sell_Bgs_And_Emotes(offer) {
  const PartnerID = offer.partner.getSteamID64();
  const MyItems = offer.itemsToGive;
  const TheirItems = offer.itemsToReceive;
  let My_Bg_And_Emote = 0;
  let Price_In_Gems = 0;
  for (let i = 0; i < MyItems.length; i += 1) {
    const MyItem = MyItems[i];
    const tag = MyItem.type;
    if (tag.includes('Profile Background') || tag.includes('Emoticon')) {
      if (!CONFIG.Restrictions.ItemsNotForTrade.includes(MyItem.name)) {
        My_Bg_And_Emote += 1;
      }
    }
  }
  Price_In_Gems = My_Bg_And_Emote * CONFIG.Rates.SELL.BG_And_Emotes;
  if (offer.itemsToGive.length == My_Bg_And_Emote) {
    const TheirGems = TheirItems.filter((gem) => gem.name == 'Gems');
    if (typeof TheirGems[0] === 'undefined') {
      offer.decline((err) => {
        if (err) {
          console.log(`[${getTime()}] ${err}`);
        }
      });
    } else {
      const gem = TheirGems[0];
      if (gem.amount == Price_In_Gems) {
        const Database = JSON.parse(
          fs
            .readFileSync('./SETTINGS/TotalSold.json')
            .toString('utf8'),
        );
        Database.Profit.Sell.CRAP[0]
          += MyItems.length * (CONFIG.Rates.SELL.BG_And_Emotes - 10);
        fs.writeFileSync(
          './SETTINGS/TotalSold.json',
          JSON.stringify(Database, undefined, '\t'),
        );
        offer.accept((err) => {
          client.chatMessage(
            PartnerID,
            'Trade Complete! Enjoy and please +Rep my profile to let others know I work!',
          );
          if (err) {
            console.log(
              `[${getTime()}] Error accepting trade during selling your BG's Emotes : ${err}`,
            );
          }
          RefreshInventory();
          client.chatMessage(
            CONFIG.Owner[1],
            `[${getTime()}] Trade Accepted From : ${PartnerID} - They bought your BGs/Emotes`,
          );
          console.log(
            `[${getTime()}] Trade Accepted From : ${PartnerID} - Bought your BGs/Emotes`,
          );
          Comment_User(offer.partner);
        });
      } else {
        // Not enough gems,decline
        client.chatMessage(
          PartnerID,
          'Rates are incorrect. Please retry using the correct rates.',
        );
        offer.decline((err) => {
          if (err) {
            console.log(`[${getTime()}] Error SELLING bgs/emotes : ${err}`);
          }
        });
      }
    }
  } else {
    client.chatMessage(
      PartnerID,
      'Sorry, Cloudbank is not for sale. Try again please with other items!',
    );
    offer.decline((err) => {
      console.log(
        `[${getTime()}] `
        + `[SellBG] Declined! ${PartnerID} - They tried to buy something blacklisted!`,
      );
      if (err) {
        console.log(`[${getTime()}] ${err}`);
      }
    });
  }
}

function Buy_Bgs_And_Emotes(offer) {
  const PartnerID = offer.partner.getSteamID64();
  const MyItems = offer.itemsToGive;
  const TheirItems = offer.itemsToReceive;
  let Their_Bg_And_Emote = 0;
  let Price_In_Gems = 0;
  for (let i = 0; i < TheirItems.length; i += 1) {
    const TheirItem = TheirItems[i];
    const tag = TheirItem.type;
    if (tag.includes('Profile Background') || tag.includes('Emoticon')) {
      if (!CONFIG.Restrictions.ItemsNotForTrade.includes(TheirItem.name)) {
        Their_Bg_And_Emote += 1;
      }
    }
  }
  Price_In_Gems = Their_Bg_And_Emote * CONFIG.Rates.BUY.BG_And_Emotes;
  if (offer.itemsToGive.length == 1) {
    const MyGems = MyItems.filter((gem) => gem.name == 'Gems');
    if (typeof MyGems[0] === 'undefined') {
      offer.decline((err) => {
        if (err) {
          console.log(
            `[${getTime()}] Error declining trade , Likely steam : ${err}`,
          );
        }
      });
    } else {
      const gem = MyGems[0];
      if (gem.amount == Price_In_Gems) {
        const Database = JSON.parse(
          fs
            .readFileSync('./SETTINGS/TotalSold.json')
            .toString('utf8'),
        );
        Database.Profit.Buy.CRAP[0]
          += TheirItems.length
          * (CONFIG.Rates.SELL.BG_And_Emotes - CONFIG.Rates.BUY.BG_And_Emotes);
        fs.writeFileSync(
          './SETTINGS/TotalSold.json',
          JSON.stringify(Database, undefined, '\t'),
        );
        offer.accept((err) => {
          client.chatMessage(
            PartnerID,
            'Trade Complete! Enjoy and please +Rep my profile to let others know I work!',
          );

          if (err) {
            console.log(
              `[${getTime()}] Error accepting trade while buying their bgs/emotes : ${err}`,
            );
          }
          RefreshInventory();
          client.chatMessage(
            CONFIG.Owner[1],
            `[${getTime()}] Trade Accepted From : ${PartnerID} - They sold you BGs/Emotes`,
          );
          console.log(
            `[${getTime()}] Trade Accepted From : ${PartnerID} - Sold you BGs/Emotes`,
          );
          Comment_User(offer.partner);
        });
      } else {
        client.chatMessage(
          PartnerID,
          "You're trying to take something that aren't gems alone / The rates may be incorrect. Please try again.",
        );
        offer.decline((err) => {
          if (err) {
            console.log(`[${getTime()}] Error BUYING bgs/emotes : ${err}`);
          }
        });
      }
    }
  } else {
    client.chatMessage(
      PartnerID,
      'Trade Validation Failed. You can only take Gems for your BGs/Emotes.',
    );
    offer.decline((err) => {
      console.log(
        `[${getTime()}] `
        + `[BuyBG] Declined! - ${PartnerID} : Tried to take something for BGs/Emotes that arent Gems`,
      );
      if (err) {
        console.log(`[${getTime()}] ${err}`);
      }
    });
  }
}
