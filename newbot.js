const {prefix, token} = require('./config.json');
const {Client, Intents, MessageActionRow, MessageButton, MessageEmbed} = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {EventEmitter} = require('events');


const myEventEmitter = new EventEmitter();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS] });

var amateurQueue = [];
var amateurQueueChannel, sealGuild, amateurQueueMessage, canPingAmateur = true,
penaltyList = [], registerList = [], logChannel, amateurQueue =[], queueEmoji,
amateurQueueExist = false, amateurQueueEmbed, amateurQueueData,
lastPingAmateur = 0, totalQueue = 10, timedRemoval = new Map();

var startUp = false;


client.login(token);

client.once('ready', () => {
  console.log("Ready!");

  botSetup(client);

});

async function botSetup(bot){

  sealGuild = bot.guilds.cache.get('681176035504422965');


  try{
    await sealGuild.fetch(true);
    await sealGuild.roles.fetch(true);

  }
  catch(error){

    console.error("UNABLE TO FETCH DATA!");
    bot.destroy();
    process.exit(1);
  }

  amateurQueueChannel = sealGuild.channels.cache.get('791131105050099742');
  logChannel = sealGuild.channels.cache.get('790982435147350036');
  queueEmoji = sealGuild.emojis.cache.get('700831087085224046');



  if(!amateurQueueChannel){
    console.error("NO AMATEUR QUEUE CHANNEL FOUND! STOPPING!");
    bot.destroy();
    process.exit(1);

  }


  let guildCommandManager = sealGuild.commands;


  await client.application.commands.set([]);
  await guildCommandManager.set([]);


 await guildCommandManager.create({
    name: 'pingamateur',
    description: 'Ping Amateur Queue',
  }).catch(console.error);

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

  await guildCommandManager.create({
    name: 'qa',
    description: 'Sends the current amateur queue list',
  }).catch(console.error);

  let completedQueueChannel = sealGuild.channels.cache.get('982619153691193415');
  await completedQueueChannel.messages.fetch();
  if(completedQueueChannel.messages.cache.size > 10){
    //await completedQueueChannel.send("1v1 mid me desire are u afraid?");
    completedQueueChannel.bulkDelete(completedQueueChannel.messages.cache.size).catch(console.error);
  }

  await amateurQueueChannel.messages.fetch();

  myEventEmitter.emit('amateurQueueStart');


}

client.on('interactionCreate', async interaction => {
  if(interaction.guild.id != 681176035504422965){
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

process.on('SIGTERM', async () => {

	console.info('SIGTERM signal received.');

	await amateurQueueMessage.delete();
  //await logChannel.send('The bot is shutting down.');
  await sealGuild.commands.set([]);
  await amateurQueueChannel.send('The bot has shut down. Please contact karra for a restart!');

	client.destroy();
	console.info('Shutdown Completed!');
	process.exit(0);



});

myEventEmitter.on('amateurQueueJoin', async (user, interaction) =>{
  //console.log(user);
  if(amateurQueue.some(u => u.id == user.id)){
    await interaction.editReply({ content: 'You are already in Queue', ephemeral: true });
    return;
  }
  else{
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

    await amateurQueueChannel.send("Poi");
    amateurQueueChannel.bulkDelete(amateurQueueChannel.messages.cache.size).catch(console.error);

    if(amateurQueue.length == totalQueue){
      await queuePopped();

      amateurQueue = [];
    }
    else{
        amateurQueue = [];
    }

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


    if(cI.member._roles.includes('681176329554886714') || cI.member._roles.includes('696355198083399730')){
      myEventEmitter.emit('amateurQueueLeave', cI.options.getUser('user'), cI);



    }
    else{
      cI.editReply({content: 'You need to be a mod or admin to run this command.'});



    }
  }
  else if(cI.commandName == 'pingamateur'){
    pingAmateur(cI);

  }

  //return reply;
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
  let completedQueueChannel = sealGuild.channels.cache.get('982619153691193415');
  let lobbyMaker = [];

  await sealGuild.members.fetch();
  for (u of amateurQueue){
    let member = sealGuild.members.cache.find(m => m.user.id == u.id);
    if(member.roles.cache.some(r => r.id == 681176329554886714) || member.roles.cache.some(r => r.id == 696355198083399730)){
      lobbyMaker.push(member.user);
    }

  }

  if(lobbyMaker.length > 0){
    completedQueueChannel.send('Queue popped! \n' + amateurQueue.join('\r\n').toString() + '\nLobby Makers: ' + lobbyMaker.join('\r\n').toString());
  }
  else{

    let adminRole = await sealGuild.roles.cache.get('681176329554886714');
    let modRole = await sealGuild.roles.cache.get('696355198083399730');

    completedQueueChannel.send('Queue popped! \n' + amateurQueue.join('\r\n').toString() + '\nLobby Makers:\n' + adminRole.toString() + " " + modRole.toString());
  }
}

async function logMessage(msg) {
  if (!logChannel){
    return;
  }

  await logChannel.send(msg);
}
