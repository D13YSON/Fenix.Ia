'use strict';

const { google } = require('googleapis');
const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const path = require('path');
const app = express();
app.use(express.json());
require('dotenv').config();

const calendar = google.calendar('v3');
const appointment_type = 'Entrega';

let nome = null;
const calendarLink = `https://www.google.com/calendar/embed?src=${process.env.GOOGLE_CALENDAR_ID}&ctz=America/Sao_Paulo`;

const serviceAccountAuth = new google.auth.JWT({
     email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
     key: process.env.GOOGLE_PRIVATE_KEY,
     scopes: 'https://www.googleapis.com/auth/calendar'
});

class DialogflowWebhook {
     constructor(request, response) {
          this.agent = new WebhookClient({ request, response });
          this.handleRequest();
     }

     handleRequest() {
          const intentMap = new Map();
          intentMap.set('Calendario', this.makeAppointment.bind(this));
          this.agent.handleRequest(intentMap);
     }

     async makeAppointment() {
          try {
               const dateParts = this.agent.parameters.Data.split('T'); 
               const timeParts = this.agent.parameters.Hora.split('T')[1];

               const dateTimeEnd = new Date(`${dateParts[0]}T${timeParts.split('-')[0]}`);

               const dateTimeStart = new Date(dateTimeEnd);
               dateTimeStart.setHours(dateTimeEnd.getHours() - 5);

               const appointmentTimeString = `${dateTimeStart.getDate()} de ${dateTimeStart.toLocaleString('pt-BR', { month: 'long' })} de ${dateTimeStart.getFullYear()} às ${dateTimeEnd.getHours()}h${dateTimeEnd.getMinutes().toString().padStart(2, '0')}`;

               const contexts = this.agent.contexts;

               contexts.forEach(context => {
                    if (context.parameters.nome) {
                         nome = context.parameters.nome[0];
                    }
               });

               await createCalendarEvent(dateTimeStart, dateTimeEnd, appointment_type);

               this.agent.add(`Agendado com sucesso! Para dia ${appointmentTimeString}`);
               this.agent.add(`Agradecemos o contato ${nome}, e desejamos um ótimo dia!
                              Qualquer coisa inicie novamente a conversa com um Oi.`);
          } catch (error) {
               if (error.message && error.message.includes('Já existe um evento no horário solicitado')) {
                    this.agent.add(`Erro ao agendar o compromisso. Detalhes: ${error.message}.`);
                    const payloadJson = {
                         "richContent": [
                             [
                                 {
                                     "type": "info",
                                     "subtitle": "clique aqui!",
                                     "title": "Acesse para selecionar um horário não conflitante",
                                     "actionLink": "https://www.google.com/calendar/embed?src=0b0a914a967a30a8e408d3a50af47beb3baf2439e321b0a6dffba12cb7a56c4c@group.calendar.google.com&ctz=America/Sao_Paulo"
                                 }
                             ]
                         ]
                     };
                     this.agent.add(new Payload(this.agent.UNSPECIFIED, payloadJson, { sendAsMessage: true, rawPayload: true }));
                     this.agent.add('Digite agendar novamente para agendarmos');
               } else {
                    this.agent.add('Erro ao agendar o compromisso.');
               }
               console.error(error);
          }
     }
}

function createCalendarEvent(dateTimeStart, dateTimeEnd, appointment_type) {
     return new Promise((resolve, reject) => {
          calendar.events.list({
               auth: serviceAccountAuth,
               calendarId: process.env.GOOGLE_CALENDAR_ID,
               timeMin: dateTimeStart.toISOString(),
               timeMax: dateTimeEnd.toISOString()
          }, (err, calendarResponse) => {
               if (err || calendarResponse.data.items.length > 0) {
                    reject(err || new Error('Já existe um evento no horário solicitado.'));
               } else {
                    calendar.events.insert({
                         auth: serviceAccountAuth,
                         calendarId: process.env.GOOGLE_CALENDAR_ID,
                         resource: {
                              summary: `${appointment_type}${nome ? ' - ' + nome : ''}`,
                              start: { dateTime: dateTimeStart },
                              end: { dateTime: dateTimeEnd }
                         }
                    }, (err, event) => {
                         if (err) {
                              reject('Erro ao criar o evento.');
                         } else {
                              resolve(`Evento agendado com sucesso para ${appointment_type} de ${dateTimeStart} até ${dateTimeEnd}`);
                         }
                    });
               }
          });
     });
}

app.post('/webhook', (req, res) => {
     new DialogflowWebhook(req, res);
});

app.get('/', (req, res) => {
     res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(8080, () => {
     console.log("START");
});