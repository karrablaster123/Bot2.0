const {prefix, token} = require('./config.json');
const {Client, Intents, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {EventEmitter} = require('events');
const { parse } = require('path');


const myEventEmitter = new EventEmitter();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS] });

var amateurQueue = [];
var amateurQueueChannel, sealGuild, amateurQueueMessage, canPingAmateur = true,
penaltyList = [], registerList = [], logChannel, amateurQueue =[], queueEmoji,
amateurQueueExist = false, amateurQueueEmbed, amateurQueueData,
lastPingAmateur = 0, totalQueue = 10, timedRemoval = new Map();

var sealGuildID = '1291500055198437416';
var amateurQueueChannelID = '1291501751999922176';
var logChannelID = '1291955888202059797';
var completedQueueChannelID = '1291958218255499387';
var adminRoleID = '1291500604283420732';

var startUp = false;


client.login(token);

client.once('ready', () => {
  console.log("Ready!");

  botSetup(client);

});

async function botSetup(bot){
  console.log("Setting up bot...");
  sealGuild = bot.guilds.cache.get(sealGuildID);


  try{
    await sealGuild.fetch(true);
    await sealGuild.roles.fetch(true);

  }
  catch(error){

    console.error("UNABLE TO FETCH DATA!");
    bot.destroy();
    process.exit(1);
  }

  amateurQueueChannel = sealGuild.channels.cache.get(amateurQueueChannelID);
  logChannel = sealGuild.channels.cache.get(logChannelID);
  queueEmoji = "👍";



  if(!amateurQueueChannel){
    console.error("NO AMATEUR QUEUE CHANNEL FOUND! STOPPING!");
    bot.destroy();
    process.exit(1);

  }


  let guildCommandManager = sealGuild.commands;


  await client.application.commands.set([]);
  await guildCommandManager.set([]);

  console.log("Creating commands...");
  await guildCommandManager.create({
    name: 'pingqueue',
    description: 'Ping Queue',
  }).catch(console.error);
  console.log("Creating commands...2");
  await guildCommandManager.create({
    name: 'remove',
    description: 'Removes a user from queue',
    options: [{
      type: 'USER',
      name: 'user',
      description: 'User for removal',
      required: true,
    }],
  }).catch(console.error);
  console.log("Creating commands...3");
  await guildCommandManager.create({
    name: 'qa',
    description: 'Sends the current amateur queue list',
  }).catch(console.error);
  console.log("Creating commands...4");
  await guildCommandManager.create({
    name: 'kys',
    description: 'kms ',
  }).catch(console.error);

  console.log("Getting Completed Queue channel data and deleting.");
  let completedQueueChannel = sealGuild.channels.cache.get(completedQueueChannelID);
  await completedQueueChannel.messages.fetch();
  if(completedQueueChannel.messages.cache.size > 10){
    //await completedQueueChannel.send("1v1 mid me desire are u afraid?");
    completedQueueChannel.bulkDelete(completedQueueChannel.messages.cache.size).catch(console.error);
  }
  console.log("Getting Amateur Queue channel data.");
  await amateurQueueChannel.messages.fetch();

  myEventEmitter.emit('amateurQueueStart');


}

client.on('interactionCreate', async interaction => {
  if(interaction.guild.id != parseInt(sealGuildID, 10)){
    return;
  }

  if(interaction.isButton()){
    if(interaction.customId == 'JoinAmateur'){
      await interaction.deferReply({ephemeral: true});
      myEventEmitter.emit('amateurQueueJoin', interaction.user, interaction);
    }

    else if(interaction.customId == 'LeaveAmateur'){
      await interaction.deferReply({ephemeral: true});
      myEventEmitter.emit('amateurQueueLeave', interaction.user, interaction);
    }
  }

  else if(interaction.isCommand()){

    await interaction.deferReply({ephemeral: true});
    processCommands(interaction);


  }

  else{
    return;
  }

});

process.once('SIGTERM', async () => {

	console.info('SIGTERM signal received.');

	await amateurQueueMessage.delete();
  //await logChannel.send('The bot is shutting down.');
  await sealGuild.commands.set([]);
  await amateurQueueChannel.send('The bot has shut down. Please contact joe for a restart!');

	client.destroy();
	console.info('Shutdown Completed!');
	process.exit(0);



});


myEventEmitter.on('amateurQueueJoin', async (user, interaction) =>{

  if(amateurQueue.some(u => u.id == user.id)) {
    await interaction.editReply({ content: 'You are already in Queue', ephemeral: true });
    return;
  }
  else {
    await interaction.editReply({ content: 'You are now in the Queue', ephemeral: true });
    amateurQueue.push(user);
    timedRemoval.set(user.id, setTimeout(() => {myEventEmitter.emit('amateurQueueLeave', user, false)}, 7200000));
    amateurQueueEmbed.setDescription(amateurQueue.join('\r\n').toString());
    amateurQueueMessage.edit({embeds: [amateurQueueEmbed], components: [amateurQueueData]});
  }

  if(amateurQueue.length == totalQueue){
    amateurQueueExist = false;
    myEventEmitter.emit('amateurQueueStart');

    for(to of timedRemoval){
      clearTimeout(to);
    }

  }

});

myEventEmitter.on('amateurQueueLeave', async (user, interaction) =>{
  if(amateurQueue.some(u => u.id == user.id)){
    amateurQueue.splice(amateurQueue.indexOf(user), 1);
    amateurQueueEmbed.setDescription(amateurQueue.join('\r\n').toString());
    amateurQueueMessage.edit({embeds: [amateurQueueEmbed], components: [amateurQueueData]});

    clearTimeout(timedRemoval.get(user.id));

    if(!interaction){
      await user.send('You have been removed from the Queue as a precautionary measure').catch(console.error);
      await logMessage(user.toString() + ' removed');
      return;
    }

    if(interaction.isButton()){
      await interaction.editReply({ content: 'You have left the Queue', ephemeral: true });
    }
    else if(interaction.isCommand()){
      await logMessage(user.toString() + " was removed by " + interaction.user.username);
      await interaction.editReply({content:'The user was removed'});
    }
  }
  else{

    if(!interaction){
      console.log("That user has already left the queue, or the queue has completed");
      await logMessage(user.toString() + ' couldn\t be removed from Queue');
      return;
    }

    if(interaction.isButton()){
      await interaction.editReply({ content: 'You weren\'t in the Queue', ephemeral: true });
    }
    else if(interaction.isCommand()){
      await interaction.editReply({content:'That user doesn\'t exist in the queue'});
    }


    return;
  }
});

myEventEmitter.on('amateurQueueStart', async () => {
  console.log("Starting Queue");
  if(amateurQueueExist){
    console.log("Queue already exists!");

  }
  else {

    amateurQueueExist = true;
    canPingAmateur = true;
    amateurQueueData = new MessageActionRow()
    .addComponents(
      [new MessageButton()
        .setCustomId('JoinAmateur')
        .setLabel('Join')
        .setStyle('PRIMARY')
        .setEmoji(queueEmoji),
        new MessageButton()
        .setCustomId('LeaveAmateur')
        .setLabel('Leave')
        .setStyle('DANGER')

      ]
    );

    amateurQueueEmbed = new MessageEmbed()
      .setColor('#ADD8E6')
      .setTitle('Current Queue')
      .setDescription(' ');
    console.log("Clearing Queue Channel");
    amateurQueueChannel.bulkDelete(amateurQueueChannel.messages.cache.size).catch(console.error);

    if(amateurQueue.length == totalQueue){
      await queuePopped();

      amateurQueue = [];
    }
    else{
        amateurQueue = [];
    }


    console.log("Sending Queue Message");
    amateurQueueMessage = await amateurQueueChannel.send({embeds: [amateurQueueEmbed], components: [amateurQueueData]});


    if(!startUp){
      console.log("Setup Complete!");
      startUp = true;
    }




  }
});

function processCommands(cI){


  if(cI.commandName == 'qa'){
    //console.log(cI);

    if(amateurQueue.length > 0 && amateurQueueExist){

      cI.editReply({content: amateurQueue.join('\r\n').toString()});
    }
    else{
      cI.editReply({content: 'Queue is empty or is not active'});
    }
  }

  else if(cI.commandName == 'remove'){


    if(cI.member._roles.includes(adminRoleID)){
      myEventEmitter.emit('amateurQueueLeave', cI.options.getUser('user'), cI);



    }
    else{
      cI.editReply({content: 'You need to be a mod or admin to run this command.'});



    }
  }
  else if(cI.commandName == 'pingqueue'){
    cI.editReply({content: 'This does not currently work.'});;

  }

  else if (cI.commandName == 'kys'){
    if (cI.member._roles.includes(adminRoleID)){
      death(cI)
      
    }
    else{
      cI.editReply({content: 'No I don\'t think so!'});
    }
  }

  //return reply;
}

async function death(cI){
  await cI.editReply({content: 'kbye!'});
  console.log("Death comes for us all.");
  await amateurQueueMessage.delete();
  //await logChannel.send('The bot is shutting down.');
  await sealGuild.commands.set([]);
  await amateurQueueChannel.send('The bot has shut down. Please contact joe for a restart!');

	client.destroy();
	console.info('Shutdown Completed!');
	process.exit(0);
}

async function pingAmateur(cI){

  let amateurPingRole = sealGuild.roles.cache.get('701027603653328968');
  pingString = amateurPingRole.toString() + ' +' + (10 - amateurQueue.length) + ' Go to ' + amateurQueueChannel.toString() + ' to join';

  if(!amateurQueueExist){
    await cI.editReply({content: 'No Queue exists'});


    return;
  }

  let timeSinceLastPing = Date.now() - lastPingAmateur;

  if(timeSinceLastPing > 600000){
    canPingAmateur = true;
  }

  if(cI.member._roles.includes('681176329554886714') || cI.member._roles.includes('696355198083399730'))
  {
    await cI.followUp({content: 'Pinging!'});
    await cI.channel.send(pingString);
    return;
  }
  else if(!canPingAmateur){
    let timeRemaining = (600000 - timeSinceLastPing)/1000;
    await cI.editReply({content: 'You cannot ping for another ' + Math.round(timeRemaining) + ' seconds.'});
  }
  else if(amateurQueue.some(u => u.id == cI.user.id)){
    await cI.followUp({content: 'Pinging'});
    await cI.channel.send(pingString);
    lastPingAmateur = Date.now();
    canPingAmateur = false;
    return;
  }
  else{
    await cI.editReply({content: 'You are not in Queue and therefore cannot ping'});
    return;
  }

}



async function queuePopped(){
  let completedQueueChannel = sealGuild.channels.cache.get(completedQueueChannelID);
  //let lobbyMaker = [];
  /*
  await sealGuild.members.fetch();
  for (u of amateurQueue){
    let member = sealGuild.members.cache.find(m => m.user.id == u.id);
    if(member.roles.cache.some(r => r.id == parseInt(adminRoleID, 10))){
      lobbyMaker.push(member.user);
    }

  } 
  */

  completedQueueChannel.send('Queue popped! \n' + amateurQueue.join('\r\n').toString());
  /*
  if(lobbyMaker.length > 0){
    completedQueueChannel.send('Queue popped! \n' + amateurQueue.join('\r\n').toString());
  }
  else{

    let adminRole = await sealGuild.roles.cache.get(adminRoleID);
    
    //completedQueueChannel.send('Queue popped! \n' + amateurQueue.join('\r\n').toString() + '\nLobby Makers:\n' + adminRole.toString());
  }*/
}

async function logMessage(msg) {
  if (!logChannel){
    return;
  }

  await logChannel.send(msg);
}
