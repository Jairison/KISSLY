// Textos legais exibidos no app. ⚠️ Rascunho: revise com um advogado antes de publicar
// e preencha os dados da empresa abaixo.

export const COMPANY = {
  name: '[RAZÃO SOCIAL DA EMPRESA]',
  cnpj: '[CNPJ]',
  address: '[ENDEREÇO COMPLETO]',
  privacyEmail: 'privacidade@kissly.app',
  supportEmail: 'suporte@kissly.app',
};

export const LEGAL_UPDATED_AT = '6 de outubro de 2026';

export type LegalDoc = {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

export type LegalDocId = 'terms' | 'privacy' | 'safety';

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: {
    title: 'Termos de Uso',
    intro: `Estes Termos regem o uso do Kissly, oferecido por ${COMPANY.name}, CNPJ ${COMPANY.cnpj}. Ao criar uma conta, você concorda com eles.`,
    sections: [
      {
        heading: '1. Quem pode usar',
        body: [
          'O Kissly é exclusivo para maiores de 18 anos. Ao se cadastrar, você declara ter 18 anos ou mais e capacidade para aceitar estes Termos.',
          'Você não pode usar o Kissly se já tiver sido banido(a) da plataforma ou se tiver sido condenado(a) por crime sexual ou violento.',
        ],
      },
      {
        heading: '2. Sua conta',
        body: [
          'Você é responsável pelas informações do seu perfil e por manter sua senha em segurança. Use fotos e dados verdadeiros: perfis falsos, de outra pessoa ou de figuras públicas não são permitidos.',
          'Você pode excluir sua conta a qualquer momento em Perfil → Excluir conta.',
        ],
      },
      {
        heading: '3. Regras de convivência',
        body: [
          'É proibido: assediar, ameaçar ou ofender outras pessoas; enviar conteúdo sexual não solicitado; praticar discriminação; pedir ou oferecer dinheiro; divulgar golpes, spam ou propaganda; compartilhar dados pessoais de terceiros; e usar o app para fins comerciais ou ilegais.',
          'Podemos remover conteúdos, suspender ou encerrar contas que violem estas regras, inclusive após denúncias de outras pessoas, e colaborar com as autoridades quando exigido por lei.',
        ],
      },
      {
        heading: '4. Assinaturas',
        body: [
          'Os planos Plus, Gold e Platinum são assinaturas cobradas pela App Store ou pelo Google Play, que renovam automaticamente pelo mesmo período e valor até serem canceladas nas configurações da loja, com pelo menos 24 horas de antecedência.',
          'Pedidos de reembolso seguem as regras da loja em que a compra foi feita, sem prejuízo dos direitos previstos no Código de Defesa do Consumidor.',
          'Recursos, limites e preços dos planos podem mudar, sempre com aviso prévio no app.',
        ],
      },
      {
        heading: '5. Responsabilidades',
        body: [
          'O Kissly aproxima pessoas, mas não verifica antecedentes criminais nem garante o comportamento de outros usuários. Leia nossas Dicas de segurança e tenha cautela em encontros presenciais.',
          'O serviço é oferecido como está, podendo passar por manutenções e mudanças.',
        ],
      },
      {
        heading: '6. Disposições gerais',
        body: [
          'Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor.',
          `Dúvidas: ${COMPANY.supportEmail}.`,
        ],
      },
    ],
  },

  privacy: {
    title: 'Política de Privacidade',
    intro: `Esta Política explica como ${COMPANY.name} (“Kissly”) trata seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD).`,
    sections: [
      {
        heading: '1. Dados que coletamos',
        body: [
          'Cadastro: e-mail, senha (guardada de forma criptografada), nome, data de nascimento, gênero e quem você quer conhecer.',
          'Perfil: fotos, bio, profissão, interesses e cidade. A localização exata do GPS é usada só para calcular distâncias e nunca é exibida para outras pessoas.',
          'Uso: curtidas, matches, mensagens, denúncias, plano assinado e dados técnicos do aparelho (como o token de notificações).',
          'Verificação: a selfie enviada para verificar o perfil, vista apenas pela equipe de segurança.',
          'Dados sensíveis: informações sobre vida sexual ou orientação podem ser inferidas do uso do app. Elas são tratadas com base no seu consentimento, apenas para o funcionamento do serviço.',
        ],
      },
      {
        heading: '2. Para que usamos',
        body: [
          'Mostrar perfis compatíveis, permitir matches e conversas, processar assinaturas, enviar notificações que você ativou, prevenir fraudes e abusos, cumprir obrigações legais e melhorar o app.',
          'Não vendemos seus dados e não usamos suas mensagens para publicidade.',
        ],
      },
      {
        heading: '3. Com quem compartilhamos',
        body: [
          'Outras pessoas do Kissly veem apenas seu perfil público: nome, idade, fotos, bio, interesses, cidade e distância aproximada.',
          'Fornecedores que operam o serviço em nosso nome: Supabase (banco de dados e armazenamento), RevenueCat, Apple e Google (assinaturas) e Expo (notificações). Alguns ficam fora do Brasil, com as salvaguardas previstas na LGPD.',
          'Autoridades, quando houver ordem judicial ou obrigação legal.',
        ],
      },
      {
        heading: '4. Por quanto tempo guardamos',
        body: [
          'Enquanto sua conta existir. Ao excluir a conta, apagamos seu perfil, fotos, selfie de verificação, matches e conversas, incluindo as fotos e áudios enviados nelas, para as duas pessoas. Ao desfazer um match ou bloquear alguém, a conversa e seus arquivos também são apagados.',
          'Guardamos apenas o mínimo exigido por lei ou necessário à segurança: registros de acesso pelo prazo do Marco Civil da Internet (6 meses) e denúncias. Se você foi denunciado(a), a denúncia é mantida para a moderação com um resumo sem fotos (nome, idade, gênero e cidade na data da denúncia), mesmo após a exclusão da conta.',
          'Assinaturas: o histórico de compras fica também com a Apple ou o Google e com o RevenueCat, que processam os pagamentos, conforme as políticas deles. Excluir a conta no Kissly não cancela a assinatura na loja.',
        ],
      },
      {
        heading: '5. Seus direitos',
        body: [
          'Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir anonimização, portabilidade ou exclusão, revogar consentimentos e saber com quem compartilhamos, conforme o art. 18 da LGPD.',
          `Para exercer seus direitos, escreva para ${COMPANY.privacyEmail}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
        ],
      },
      {
        heading: '6. Segurança',
        body: [
          'Usamos criptografia em trânsito, controle de acesso por linha no banco de dados e armazenamento separado para as selfies de verificação. Nenhum sistema é 100% seguro: avise-nos imediatamente se suspeitar de acesso indevido à sua conta.',
        ],
      },
      {
        heading: '7. Contato do encarregado (DPO)',
        body: [`${COMPANY.name} · ${COMPANY.address} · ${COMPANY.privacyEmail}`],
      },
    ],
  },

  safety: {
    title: 'Dicas de segurança',
    intro: 'Conhecer gente nova é ótimo e deve ser seguro também. Siga estas dicas e confie no seu instinto.',
    sections: [
      {
        heading: 'Antes do encontro',
        body: [
          'Converse bastante pelo app antes de passar seu número ou redes sociais.',
          'Prefira perfis com o selo azul de verificado. Desconfie de quem evita videochamada ou tem pressa em sair do app.',
          'Nunca envie dinheiro, PIX, presentes ou dados bancários, por mais convincente que seja a história.',
        ],
      },
      {
        heading: 'No primeiro encontro',
        body: [
          'Marque em um lugar público e movimentado, e vá com o seu próprio transporte.',
          'Conte a um amigo ou familiar onde você vai, com quem e a que horas pretende voltar. Compartilhe sua localização em tempo real.',
          'Fique atento(a) à sua bebida e não deixe copos sozinhos.',
          'Se algo parecer errado, vá embora. Você não deve explicações.',
        ],
      },
      {
        heading: 'Denuncie',
        body: [
          'Use o menu “⋯” em qualquer conversa para denunciar. A denúncia é anônima e a pessoa não é avisada.',
          'Em perigo, ligue para a Polícia: 190. Violência contra a mulher: 180. Direitos humanos: Disque 100. Apoio emocional (CVV): 188.',
        ],
      },
    ],
  },
};
