const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function randomNo() {
  return String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')
}

async function pickAvailableNo(transaction) {
  for (let i = 0; i < 200; i++) {
    const no = randomNo()
    const exists = await transaction.collection('reservations')
      .where({ reservationNo: no })
      .field({ _id: true })
      .limit(1)
      .get()

    if (!exists.data.length) return no
  }

  for (let n = 1; n <= 999; n++) {
    const no = String(n).padStart(3, '0')
    const exists = await transaction.collection('reservations')
      .where({ reservationNo: no })
      .field({ _id: true })
      .limit(1)
      .get()

    if (!exists.data.length) return no
  }

  throw new Error('reservation no exhausted')
}

exports.main = async (event, context) => {
  const { reservationId } = event || {}
  if (!reservationId) {
    return { success: false, error: 'reservationId is required' }
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  for (let retry = 0; retry < 3; retry++) {
    try {
      const result = await db.runTransaction(async transaction => {
        const docRes = await transaction.collection('reservations').doc(reservationId).get()
        const reservation = docRes.data

        if (!reservation) {
          throw new Error('reservation not found')
        }

        if (reservation._openid && reservation._openid !== openid) {
          throw new Error('no permission')
        }

        if (reservation.reservationNo) {
          return { reservationNo: reservation.reservationNo, assigned: false }
        }

        const reservationNo = await pickAvailableNo(transaction)

        await transaction.collection('reservations').doc(reservationId).update({
          data: { reservationNo }
        })

        return { reservationNo, assigned: true }
      })

      return {
        success: true,
        reservationNo: result.reservationNo,
        assigned: result.assigned
      }
    } catch (err) {
      const msg = String((err && err.message) || err || '')
      if (retry < 2 && msg.toLowerCase().includes('conflict')) {
        continue
      }
      return { success: false, error: msg }
    }
  }

  return { success: false, error: 'assign failed after retries' }
}