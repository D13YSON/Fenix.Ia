'use strict';

const { google } = require('googleapis');
const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const path = require('path');
const app = express();
app.use(express.json());
require('dotenv').config();

const calendar = google.calendar('v3');
const timeZone = 'America/Sao_Paulo';
const timeZoneOffset = '-03:00';
const appointment_type = 'Entrega';

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
               const dateTimeStart = new Date(Date.parse(this.agent.parameters.Data.split('T')[0] + 'T' + this.agent.parameters.Hora.split('T')[1].split('-')[0] + timeZoneOffset));

               const dateTimeEnd = new Date(new Date(dateTimeStart).setHours(dateTimeStart.getHours() + 1));

               const appointmentTimeString = dateTimeStart.toLocaleString(
                    'pt-BR',
                    {
                         month: 'long',
                         day: 'numeric',
                         hour: 'numeric',
                         timeZone: timeZone
                    });

               console.log("Hora:", this.agent.parameters.Hora);
               console.log("Data:", this.agent.parameters.Data);
               console.log("Start:", dateTimeStart);
               console.log("End:", dateTimeEnd);

               const response = await createCalendarEvent(dateTimeStart, dateTimeEnd, appointment_type);

               this.agent.add(`Deu bom. ${appointmentTimeString} agendado com sucesso!`);
          } catch (error) {
               console.log("DEU RUIM", error);
               this.agent.add('Erro ao agendar o compromisso.');
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
                              summary: `${appointment_type}`,
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