/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request');

const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// valores iniciais da nossa enquete
const resultados_enquete = {
  'enquete.lista_telefones': 0,
  'enquete.lista_websites': 0,
  'enquete.enquete': 0,
};

const votos_usuarios = {};

// funcao para computar votos e responder o usuario
function updateResults(event) {
  const payload = event.postback.payload;
  const senderID = event.sender.id;
  const usuarioJaVotou = votos_usuarios[senderID] ? true : false;

  // desconta o voto antigo caso ja tenha votado
  if(usuarioJaVotou) {
    opcao = votos_usuarios[senderID];
    resultados_enquete[payload] = resultados_enquete[payload] - 1;
  }

  // registra o novo voto
  votos_usuarios[senderID] = payload;

  // incrementa o total de votos
  resultados_enquete[payload] = resultados_enquete[payload] + 1;

  console.log('Totais atualizados', resultados_enquete);

  if (usuarioJaVotou) {
    return {
      text: 'Você já tinha votado então trocamos a sua opção.',
    };
  }

  return {
    text: 'Voto registrado',
  };
}

// funcao para calcular os totais de votos
function getResults() {
  console.log('Resultado enquete', resultados_enquete);
  const resultados_txt =
    `* Lista Telefones: ${resultados_enquete['enquete.lista_telefones']} votos\n` +
    `* Lista Sites: ${resultados_enquete['enquete.lista_websites']} votos\n` +
    `* Lista Enquete: ${resultados_enquete['enquete.enquete']} votos\n`;

  return {
    text: 'Até agora, temos os seguintes resultados\n' + resultados_txt,
  };
}

module.exports = {

  // opcoes do menu que o usuario tem disponivel o tempo todo
  menu_config: {
    "setting_type" : "call_to_actions",
    "thread_state" : "existing_thread",
    "call_to_actions":[
      {
        "type":"postback",
        "title":"Telefones",
        "payload":"telefones"
      },
      {
        "type":"postback",
        "title":"teste",
        "payload":"teste"
      },
      {
        "type":"postback",
        "title":"Votar",
        "payload":"votar"
      },
      {
        "type":"postback",
        "title":"Ver Resultado",
        "payload":"resultado"
      },
    ]
  },

  all_messages: {
    'telefones': {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Aqui estão alguns telefones úteis:",
          buttons:[
            {
              type: "phone_number",
              title: "Pizzaria",
              payload: "+552131312929"
            },
            {
              type: "phone_number",
              title: "CUFA",
              payload: "+552131312828"
            },
          ]
        }
      }
    },

    'teste': {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements":[
             {
              "title":"Welcome to Peter\'s Hats",
              "image_url":"https://petersfancybrownhats.com/company_image.png",
              "subtitle":"We\'ve got the right hat for everyone.",
              "default_action": {
                "type": "web_url",
                "url": "https://peterssendreceiveapp.ngrok.io/view?item=103",
              },
              "buttons":[
                {
                  "type":"web_url",
                  "url":"https://petersfancybrownhats.com",
                  "title":"View Website"
                },{
                  "type":"postback",
                  "title":"Start Chatting",
                  "payload":"DEVELOPER_DEFINED_PAYLOAD"
                }
              ]
            }
          ]
        }
      }
    },


    'sites': {},


    'votar': {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Qual opção você gostou mais?",
          buttons:[
            {
              type: "postback",
              title: "Lista de Telefones",
              payload: "enquete.lista_telefones",
            },
            {
              type: "postback",
              title: "Lista de Websites",
              payload: "enquete.lista_telefones",
            },
            {
              type: "postback",
              title: "Enquete",
              payload: "enquete.enquete",
            },
          ]
        }
      }
    },

    // Resultados da enquete. Sao calculados pela funcao updateResults
    'enquete.lista_telefones': updateResults,
    'enquete.lista_websites': updateResults,
    'enquete.enquete': updateResults,

    'resultado': getResults,
  },

  //////////////////////////////////////////////////////////////////////////////////////////////////////
  // Nao mexer daqui para baixo
  //////////////////////////////////////////////////////////////////////////////////////////////////////

  getMessage: function(event) {
    const payload = event.postback.payload;
    ret = this.all_messages[payload];

    if(ret instanceof Function) {
      // getResults nao recebe parametro. ele e ignorado
      return ret(event)
    }
    return ret;
  },

  setMenu: function(config) {
    request({
      uri: 'https://graph.facebook.com/v2.6/me/thread_settings',
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: config

    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log("Successfully set up thread menu", body)
      } else {
        console.error("Error setting up thread menu", body);
      }
    });
  },

  deleteMenu: function() {
    request({
      uri: 'https://graph.facebook.com/v2.6/me/thread_settings',
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: 'DELETE',
      json: {
        "setting_type":"call_to_actions",
        "thread_state":"existing_thread"
      }

    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log("Successfully removed thread menu", body)
      } else {
        console.error("Error removing thread menu", body);
      }
    });
  }

};
