import { isEmpty, some } from 'lodash';
import axios from 'axios';

import {
  findBySiret,
  findByUserId,
  create,
  addUser,
  getUsers,
} from '../repositories/organization';
import { isSiretValid } from '../services/security';
import { findById as findUserById } from '../repositories/user';
import { sendMail } from '../connectors/sendinblue';

export const joinOrganization = async (siret, user_id) => {
  // Ensure siret is valid
  if (!isSiretValid(siret)) {
    throw new Error('invalid_siret');
  }

  const siretNoSpaces = siret.replace(/\s/g, '');
  let nom_raison_sociale = null;
  let tranche_effectifs = null;

  try {
    const {
      data: { etablissement },
    } = await axios({
      method: 'get',
      url: `https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/${siretNoSpaces}`,
    });

    const siretFromSireneApi = etablissement.siret;
    nom_raison_sociale = etablissement.unite_legale.denomination;
    tranche_effectifs = etablissement.tranche_effectifs;

    if (siretFromSireneApi !== siretNoSpaces) {
      throw new Error('invalid response from sirene API');
    }

    if (etablissement.etat_administratif !== 'A') {
      // A : Actif;
      // see: https://www.sirene.fr/sirene/public/variable/etatAdministratifEtablissement
      throw new Error('organization is not active');
    }
  } catch (error) {
    console.error(error);

    throw new Error('invalid_siret');
  }

  // Ensure user_id is valid
  const user = await findUserById(user_id);

  if (isEmpty(user)) {
    throw new Error('user_not_found');
  }

  // Ensure user can join organization automatically
  const { email, given_name, family_name } = user;
  const emailDomain = email.split('@').pop();
  let organization = await findBySiret(siretNoSpaces);

  if (
    !isEmpty(organization) &&
    !organization.authorized_email_domains.includes(emailDomain)
  ) {
    // do not await for mail to be sent as it can take a while
    sendMail({
      to: ['auth@api.gouv.fr'],
      subject: '[api.gouv.fr] Demande pour rejoindre une organisation',
      template: 'unable-to-auto-join-organization',
      params: { email, siret: siretNoSpaces, nom_raison_sociale },
      sendText: true,
    });
    throw new Error('unable_to_auto_join_organization');
  }

  // Create organization if needed
  if (isEmpty(organization)) {
    organization = await create({
      siret: siretNoSpaces,
      authorized_email_domains: [emailDomain],
    });
  }

  // Ensure user is not in organization already
  const usersInOrganizationAlready = await getUsers(organization.id);
  if (
    !isEmpty(organization) &&
    some(usersInOrganizationAlready, ['email', email])
  ) {
    throw new Error('user_in_organization_already');
  }

  // Link user to organization
  await addUser({ organization_id: organization.id, user_id });

  const user_label =
    !given_name && !family_name ? email : `${given_name} ${family_name}`;

  if (usersInOrganizationAlready.length > 0) {
    // do not await for mail to be sent as it can take a while
    sendMail({
      to: usersInOrganizationAlready.map(({ email }) => email),
      cc: [email, 'auth@api.gouv.fr'],
      subject: 'Votre organisation sur api.gouv.fr',
      template: 'join-organization',
      params: { user_label, nom_raison_sociale },
    });
  }

  // Notify administrators if someone joined an organization with more than 500 employees
  if (['41', '42', '51', '52', '53'].includes(tranche_effectifs)) {
    // see https://www.sirene.fr/sirene/public/variable/tefen
    // do not await for mail to be sent as it can take a while
    sendMail({
      to: ['auth@api.gouv.fr'],
      subject:
        '[auth.api.gouv.fr] Un utilisateur à rejoint une organisation de plus de 500 employés',
      template: 'notify-join-big-organization',
      params: { user_label, email, nom_raison_sociale, siret: siretNoSpaces },
      sendText: true,
    });
  }

  return true;
};

export const getOrganizationsByUserId = findByUserId;
