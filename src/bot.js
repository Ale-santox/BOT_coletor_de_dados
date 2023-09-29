const wppconnect = require('@wppconnect-team/wppconnect');
const firebasedb = require('./firebase.js');

var userStages = [];

wppconnect.create({
  session: 'whatsbot',
  autoClose: false,
  puppeteerOptions: { args: ['--no-sandbox'] }
})

.then((client) =>
  client.onMessage((message) => {
    console.log('Mensagem digitada pelo usuário: ' + message.body);
    queryUserByPhone(client, message);
  })
)

.catch((error) => console.log(error));

async function queryUserByPhone(client, message) {
  let phone = (message.from).replace(/[^\d]+/g, '');
  let userdata = await firebasedb.queryByPhone(phone);
  if (userdata == null) {
    userdata = await saveUser(message);
  }
  console.log('Usuário corrente: ' + userdata['id']);
  stages(client, message, userdata);
}

// Stages = ola  >>  nome  >>  cpf  >>  fim
async function stages(client, message, userdata) {
  console.log('Mensagem recebida:', message.body); // Log para depuração
  if (userStages[message.from] == undefined) {
    sendWppMessage(client, message.from, `Olá, sou Jarvis, coletor de dados da (nome da empresa)`);
  }
  if (userdata['nome'] == undefined) {
    if (userStages[message.from] == undefined) {
      sendWppMessageWithDelay(client, message.from, 'Poderia dizer seu primeiro nome?', 900);
      userStages[message.from] = 'nome';
    } else {
      userdata['nome'] = message.body;
      const name = message.body;
      firebasedb.update(userdata);
      sendWppMessage(client, message.from, 'Certo, ' + name);
      sendWppMessageWithDelay(client, message.from, 'Digite seu *CPF* por favor.', 900);
      userStages[message.from] = 'cpf';
    }
  } else if (userdata['cpf'] == undefined) {
    if (userStages[message.from] == undefined) {
      sendWppMessageWithDelay(client, message.from, 'Digite seu *CPF* por favor.', 900);
      userStages[message.from] = 'cpf';
    } else {
      userdata['cpf'] = (message.body).replace(/[^\d]+/g, '');
      const cpf = (message.body).replace(/[^\d]+/g, '');
      firebasedb.update(userdata);
      sendWppMessage(client, message.from, 'CPF informado: ' + cpf);
      if (userdata['nome'] && userdata['cpf']) {
        sendWppMessageWithDelay(client, message.from, 'Dados coletados, conversa encerrada.', 900);
        return;
      }
    }
  } else if (message.body.toLowerCase() === '/dados') {
    console.log('Comando /dados reconhecido.'); // Log para depuração
    // Comando para revisar dados
    sendWppMessage(client, message.from, `*Seus Dados:*\nNOME: ${userdata['nome']}\nCPF: ${userdata['cpf']}`);
    return;
  } else if (message.body.toLowerCase() === '/refazer') {
    console.log('Comando /RefazerColeta reconhecido.'); // Log para depuração
    // Comando para refazer a coleta de dados
    sendWppMessage(client, message.from, 'Vamos refazer a coleta de dados.');
    delete userdata['nome'];
    delete userdata['cpf'];
    firebasedb.update(userdata);
    sendWppMessage(client, message.from, 'Poderia dizer seu nome novamente?');
    userStages[message.from] = 'nome';
  } else {
    sendMenu(client, message.from, userdata['nome']); 
  }
}

function sendMenu(client, to, userName) {
  sendWppMessageWithDelay(client, to, `Olá ${userName}, digite um comando\n/dados\n/refazer`, 900);
}


function sendWppMessageWithDelay(client, to, message, delay) {
  setTimeout(() => {
    sendWppMessage(client, to, message);
  }, delay);
}

function sendWppMessage(client, sendTo, text) {
  client.sendText(sendTo, text)
  .then((result) => {})
  .catch((erro) => {
    console.error('ERRO: ', erro);
  });
}

async function saveUser(message) {
  let user = {
    'whatsapp': (message.from).replace(/[^\d]+/g, '')
  }
  let newUser = firebasedb.save(user);
  return newUser;
}
