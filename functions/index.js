const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const SALAS_CHAT = [
  "geral",
  "concurso",
  "transito",
  "lugares",
  "eventos",
  "entretenimento",
  "games",
  "futebol",
  "religiao",
  "politica"
];

/* COMO FUNCIONA OS CARACTERES DAS HORAS   

*       *       *       *       *
minuto  hora   dia(mês)  mês   dia(semana)
Para rodar às 04:00 da madrugada:   COLOCAR ASSIM schedule: "0 4 * * *",  
 
DEPOIS DE ALTERAR RODA : NO CMD firebase deploy --only functions

APARECER ESSA MENAGEM Would you like to proceed with deletion? Selecting no will continue the rest of the deployments. aperta N..

*/
exports.limpezaMensagensAntigas = onSchedule(
  {
    schedule: "28 15 * * *",// <--- HORÁRIO em minutos 
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    const LIMITE = 10; // Preserva sempre as 10 mensagens mais recentes em cada sala // <--- QUANTIDADE DE MENSAGENS A MANTER

    for (const salaId of SALAS_CHAT) {
      try {
        const mensagensRef = db
          .collection("salas")
          .doc(salaId)
          .collection("messages");

        const snap = await mensagensRef.orderBy("createdAt", "desc").get();

        if (snap.size > LIMITE) {
          const sobras = snap.docs.slice(LIMITE);
          const batch = db.batch();

          sobras.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });

          await batch.commit();
          console.log(`[LIMPEZA] Sala ${salaId}: ${sobras.length} mensagens antigas removidas.`);
        }
      } catch (err) {
        console.error(`Erro ao limpar a sala ${salaId}:`, err);
      }
    }
  }
);