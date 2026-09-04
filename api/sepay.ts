import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const firebaseApiKey = 'AIzaSyDBseWlQG56fdyiPjl8dMNLOmKDQEGGFKM';

export const SEPAY_CONFIG = {
  apiToken: 'HGW0NPFFQH9EGDL4ZT1521FQH4BOGKSWE7BBCD6NHV23SLS6KXJQZWIYXEJKXKYD',
  bankAccount: '001801200500',
  bankName: 'MBBank',
  accountName: 'NGUYEN TUAN MANH',
} as const;

export const SEPAY_PACKAGES = {
  'topup-60': {
    id: 'topup-60',
    name: 'Túi Linh Thạch',
    crystals: 60,
    amount: 29000,
    tag: '29.000đ',
    desc: 'Nhận ngay 60 Linh Thạch để trải nghiệm trang trí thành.',
  },
  'topup-180': {
    id: 'topup-180',
    name: 'Hòm Linh Thạch',
    crystals: 180,
    amount: 79000,
    tag: '79.000đ (+20 bonus)',
    desc: 'Nhận 180 Linh Thạch (Tặng thêm 20 · Đủ mở Long Vân Pass).',
  },
  'topup-450': {
    id: 'topup-450',
    name: 'Rương Linh Thạch',
    crystals: 450,
    amount: 179000,
    tag: '179.000đ (+60 bonus)',
    desc: 'Nhận 450 Linh Thạch (Tặng thêm 60 cho bộ sưu tập).',
  },
} as const;

type SepayOrder = {
  orderCode: string;
  uid: string;
  packageId: string;
  amount: number;
  crystals: number;
  status: 'pending' | 'completed';
  createdAt: number;
  completedAt?: number;
  txId?: string;
};

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateOrderCode = () => {
  let code = 'HZB';
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
};

const getSepayQrUrl = (amount: number, orderCode: string) =>
  `https://qr.sepay.vn/img?acc=${SEPAY_CONFIG.bankAccount}&bank=${SEPAY_CONFIG.bankName}&amount=${amount}&des=${orderCode}&template=compact`;

const getVietQrUrl = (amount: number, orderCode: string) =>
  `https://img.vietqr.io/image/MB-${SEPAY_CONFIG.bankAccount}-compact2.png?amount=${amount}&addInfo=${orderCode}&accountName=${encodeURIComponent(SEPAY_CONFIG.accountName)}`;

const verifyUser = async (request: any) => {
  const authorization = String(request.headers?.authorization ?? '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const result = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!result.ok) return null;
  const data = (await result.json()) as {
    users?: Array<{ localId: string; displayName?: string; email?: string }>;
  };
  return data.users?.[0] ?? null;
};

const creditUserCrystals = async (uid: string, crystalsToAdd: number) => {
  const key = `hanzibeat:progression:${uid}`;
  const progression = (await redis.get<any>(key)) ?? {
    uid,
    dragonCrystals: 150,
  };
  const current = Number(progression.dragonCrystals ?? 0);
  progression.dragonCrystals = Math.min(999_999, current + crystalsToAdd);
  await redis.set(key, progression);
  return progression.dragonCrystals;
};

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');

  try {
    // 1. Xử lý webhook từ SePay (SePay thường gửi POST)
    if (request.method === 'POST' && request.body && (request.body.transaction_content || request.body.content)) {
      const content = String(request.body.transaction_content || request.body.content || '').toUpperCase();
      const amountIn = Number(request.body.amount_in || request.body.amount || 0);
      const txId = String(request.body.id || request.body.reference_number || crypto.randomUUID());

      const codeMatch = content.match(/HZB[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}/);
      if (codeMatch) {
        const orderCode = codeMatch[0];
        const orderKey = `hanzibeat:sepay:order:${orderCode}`;
        const order = await redis.get<SepayOrder>(orderKey);

        if (order && order.status === 'pending' && amountIn >= order.amount) {
          const lockKey = `hanzibeat:sepay:processed-tx:${txId}`;
          const isFresh = await redis.set(lockKey, '1', { nx: true });
          if (isFresh) {
            order.status = 'completed';
            order.completedAt = Date.now();
            order.txId = txId;
            await redis.set(orderKey, order, { ex: 86400 * 7 });
            await creditUserCrystals(order.uid, order.crystals);
          }
        }
      }
      return response.status(200).json({ success: true });
    }

    // 2. Action: Tạo đơn nạp (create-order)
    const action = String(request.body?.action || request.query?.action || '');

    if (action === 'create-order') {
      const user = await verifyUser(request);
      if (!user) {
        return response.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
      }

      const packageId = String(request.body?.packageId ?? '') as keyof typeof SEPAY_PACKAGES;
      const pack = SEPAY_PACKAGES[packageId];
      if (!pack) {
        return response.status(400).json({ error: 'Gói nạp Linh Thạch không hợp lệ.' });
      }

      const orderCode = generateOrderCode();
      const order: SepayOrder = {
        orderCode,
        uid: user.localId,
        packageId: pack.id,
        amount: pack.amount,
        crystals: pack.crystals,
        status: 'pending',
        createdAt: Date.now(),
      };

      const orderKey = `hanzibeat:sepay:order:${orderCode}`;
      await redis.set(orderKey, order, { ex: 1800 }); // TTL 30 phút

      const qrUrl = getSepayQrUrl(pack.amount, orderCode);
      const vietqrUrl = getVietQrUrl(pack.amount, orderCode);

      return response.status(200).json({
        orderCode,
        amount: pack.amount,
        crystals: pack.crystals,
        packageName: pack.name,
        bankAccount: SEPAY_CONFIG.bankAccount,
        bankName: SEPAY_CONFIG.bankName,
        accountName: SEPAY_CONFIG.accountName,
        qrUrl,
        vietqrUrl,
        expiresInSeconds: 1800,
      });
    }

    // 3. Action: Kiểm tra trạng thái đơn nạp (check-order)
    if (action === 'check-order') {
      const user = await verifyUser(request);
      if (!user) {
        return response.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
      }

      const orderCode = String(request.body?.orderCode || request.query?.orderCode || '').trim().toUpperCase();
      if (!orderCode) {
        return response.status(400).json({ error: 'Thiếu mã đơn nạp.' });
      }

      const orderKey = `hanzibeat:sepay:order:${orderCode}`;
      const order = await redis.get<SepayOrder>(orderKey);
      if (!order) {
        return response.status(404).json({ error: 'Đơn nạp không tồn tại hoặc đã hết hạn.' });
      }

      if (order.uid !== user.localId) {
        return response.status(403).json({ error: 'Đơn nạp không thuộc về tài khoản này.' });
      }

      // Đã hoàn thành trước đó
      if (order.status === 'completed') {
        const progressionKey = `hanzibeat:progression:${user.localId}`;
        const progression = await redis.get<any>(progressionKey);
        return response.status(200).json({
          status: 'completed',
          crystals: order.crystals,
          newBalance: progression?.dragonCrystals ?? 0,
        });
      }

      // Đang chờ: Chủ động truy vấn SePay API v2 để đối chiếu tức thời
      try {
        const sepayRes = await fetch(
          `https://userapi.sepay.vn/v2/transactions?account_number=${SEPAY_CONFIG.bankAccount}&per_page=20`,
          {
            headers: { Authorization: `Bearer ${SEPAY_CONFIG.apiToken}` },
          },
        );

        if (sepayRes.ok) {
          const resData = (await sepayRes.json()) as {
            status?: string;
            data?: Array<{
              id: string;
              transfer_type: string;
              amount_in: number;
              transaction_content: string;
            }>;
          };

          const matchedTx = resData.data?.find((tx) => {
            if (tx.transfer_type !== 'in') return false;
            const amountIn = Number(tx.amount_in ?? 0);
            if (amountIn < order.amount) return false;
            const content = String(tx.transaction_content ?? '').toUpperCase();
            return content.includes(orderCode);
          });

          if (matchedTx) {
            const lockKey = `hanzibeat:sepay:processed-tx:${matchedTx.id}`;
            const isFresh = await redis.set(lockKey, '1', { nx: true });
            if (isFresh) {
              order.status = 'completed';
              order.completedAt = Date.now();
              order.txId = matchedTx.id;
              await redis.set(orderKey, order, { ex: 86400 * 7 });
              const newBalance = await creditUserCrystals(user.localId, order.crystals);
              return response.status(200).json({
                status: 'completed',
                crystals: order.crystals,
                newBalance,
              });
            } else {
              // Giao dịch đã được xử lý qua webhook hoặc luồng khác
              order.status = 'completed';
              await redis.set(orderKey, order, { ex: 86400 * 7 });
              const progressionKey = `hanzibeat:progression:${user.localId}`;
              const progression = await redis.get<any>(progressionKey);
              return response.status(200).json({
                status: 'completed',
                crystals: order.crystals,
                newBalance: progression?.dragonCrystals ?? 0,
              });
            }
          }
        }
      } catch (pollErr) {
        console.warn('[SePay Poll Error]:', pollErr);
      }

      return response.status(200).json({
        status: 'pending',
        message: 'Hệ thống đang kiểm tra giao dịch chuyển khoản...',
      });
    }

    // 4. Lấy danh sách gói nạp (catalog)
    if (request.method === 'GET') {
      return response.status(200).json({
        packages: Object.values(SEPAY_PACKAGES),
        bankConfig: {
          bankName: SEPAY_CONFIG.bankName,
          bankAccount: SEPAY_CONFIG.bankAccount,
          accountName: SEPAY_CONFIG.accountName,
        },
      });
    }

    return response.status(400).json({ error: 'Hành động không hợp lệ.' });
  } catch (error: any) {
    console.error('[SePay API Error]:', error);
    return response.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.', details: error?.message });
  }
}
