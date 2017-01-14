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
  'enquete.listas': 0,
  'enquete.localizacao': 0,
  'enquete.enquete': 0,
};

const votos_usuarios = {};
const permitir_votos_duplicados = true;

// funcao para computar votos e responder o usuario
function updateResults(event) {
  const payload = event.postback.payload;
  const senderID = event.sender.id;
  const usuarioJaVotou = votos_usuarios[senderID] ? true : false;

  // desconta o voto antigo caso ja tenha votado
  if(!permitir_votos_duplicados && usuarioJaVotou) {
    const opcao = votos_usuarios[senderID];
    resultados_enquete[opcao] = resultados_enquete[opcao] - 1;
  }

  // registra o novo voto
  votos_usuarios[senderID] = payload;

  // incrementa o total de votos
  resultados_enquete[payload] = resultados_enquete[payload] + 1;

  console.log('Voto registrado. Totais atualizados\n', resultados_enquete);

  if (!permitir_votos_duplicados && usuarioJaVotou) {
    return {
      text: 'Você já tinha votado então trocamos a sua opção.' + getResultsStr(),
    };
  }

  return {
    text: 'Voto registrado\n' + getResultsStr(),
  };
}

function getResultsStr() {
  const resultados_txt =
    `* Listas: ${resultados_enquete['enquete.listas']} votos\n` +
    `* Compartilhar Localização: ${resultados_enquete['enquete.localizacao']} votos\n` +
    `* Enquete: ${resultados_enquete['enquete.enquete']} votos\n`;

  return 'Até agora, temos os seguintes resultados\n' + resultados_txt;
}

// funcao para retornar mensagem com os totais de votos
function getResults() {
  console.log('Resultado enquete', resultados_enquete);

  return {
    text: getResultsStr(),
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
        "title":"Sites",
        "payload":"sites"
      },
      {
        "type":"postback",
        "title":"Enviar sua Localização",
        "payload":"localizacao"
      },
      {
        "type":"postback",
        "title":"Votar Enquete",
        "payload":"votar"
      },
      {
        "type":"postback",
        "title":"Ver Resultado Enquete",
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
              title: "CUFA",
              payload: "+552124588035"
            },
          ]
        }
      }
    },

    'sites': {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements":[
             {
                "title":"CUFA",
                "image_url":"https://www.cufa.org.br/assets/img/logo.png",
                "subtitle":"Site da CUFA",
                "default_action": {
                  "type": "web_url",
                  "url": "https://www.cufa.org.br/",
                },
                "buttons": [
                  {
                    "type":"web_url",
                    "url":"https://www.cufa.org.br/",
                    "title":"Visitar Website"
                  },
                ],
              },
              {
                "title":"Facebook",
                "subtitle":"Facebook",
                "default_action": {
                  "type": "web_url",
                  "url": "https://www.facebook.com/",
                },
                "buttons": [
                  {
                    "type":"web_url",
                    "url":"https://www.facebook.com/",
                    "title":"Visitar Website"
                  },
                ],
              },
              {
                "title":"Platforma do Messenger",
                "subtitle":"Guia Messenger Bots",
                "default_action": {
                  "type": "web_url",
                  "url": "https://developers.facebook.com/docs/messenger-platform",
                },
                "buttons": [
                  {
                    "type":"web_url",
                    "url":"https://developers.facebook.com/docs/messenger-platform",
                    "title":"Visitar Website"
                  },
                ],
              },
          ]
        }
      }
    },

    'localizacao': {
      "text":"Compartilhe sua localização",
      "quick_replies":[
        {
          "content_type":"location",
        }
      ]
    },


    'votar': {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Qual opção você gostou mais?",
          buttons:[
            {
              type: "postback",
              title: "Listas",
              payload: "enquete.listas",
            },
            {
              type: "postback",
              title: "Localização",
              payload: "enquete.localizacao",
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

    // Resultados da enquete. todas as opcoes devem ser adicionadas aqui
    'enquete.listas': updateResults,
    'enquete.localizacao': updateResults,
    'enquete.enquete': updateResults,

    'resultado': getResults,
  },

  getMessage: function(event) {
    const payload = event.postback.payload;
    const ret = this.all_messages[payload];

    if(ret instanceof Function) {
      // getResults nao recebe parametro. ele e ignorado
      return ret(event);
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
