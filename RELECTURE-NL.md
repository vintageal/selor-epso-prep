# Relecture de la version néerlandaise

Points à faire vérifier par une personne néerlandophone de Belgique, idéalement familière du registre de l'administration flamande et fédérale. Ce fichier n'est pas publié : il n'est pas dans `dist/`.

Pour chaque point, il faut confirmer le choix actuel ou proposer mieux. Toute correction se fait dans les fichiers indiqués, en gardant les mêmes identifiants et les mêmes bonnes réponses. Les tests le vérifient.

## 1. Raisonnement verbal : les trois réponses

Fichiers : `assets/js/i18n/nl.js` (clé `verbal.answers` et explications des réponses) et `src/i18n/nl.json` (consignes de la page).

| Français | Néerlandais actuel | Raccourci clavier |
|---|---|---|
| Vrai | **Waar** | `w` |
| Faux | **Niet waar** | `n` |
| On ne peut pas savoir | **Kan niet worden bepaald** | `?` |

- Est-ce la formulation habituelle des tests de raisonnement verbal en néerlandais (Werkenvoor.be, EPSO) ? Variantes possibles : « Onwaar », « Niet te bepalen », « Kan niet worden afgeleid », « Onvoldoende informatie ».
- Les explications des 60 affirmations (`data/nl/verbal.json`) justifient cette troisième réponse par « kan (dus) niet worden bepaald ». Un test l'exige : si le libellé change, il faut adapter les explications et ce test.

## 2. Institutions adaptées au contexte flamand

Fichier : `data/nl/jugement.json`. Les situations sont fictives ; certaines ont été transposées plutôt que traduites mot à mot.

| Situation | Français | Néerlandais | À vérifier |
|---|---|---|---|
| `dossier-dun-proche` | administration de la Fédération Wallonie-Bruxelles | administratie van de **Vlaamse Gemeenschap** | La transposition est-elle pertinente ? Faut-il garder une administration neutre ? |
| `dossier-dun-proche` | ASBL | **vzw** | Terme correct. |
| `pic-de-demandes-ete` | assistant(e) social(e) dans un CPAS | **maatschappelijk werker** in een **OCMW** | « OCMW » ou « lokaal bestuur / sociale dienst », puisque les OCMW flamands sont intégrés aux communes depuis 2019 ? |
| `demarche-en-ligne-seulement` | espace public numérique | **openbare computerruimte** | En Flandre, le terme courant est-il « digitaal ontmoetingspunt », « EOC » ou « digipunt » ? |
| `question-hors-competence` | service régional de l'emploi | **gewestelijke dienst voor arbeidsbemiddeling** | Formulation volontairement générique : est-elle naturelle ? |
| plusieurs | administration régionale, administration communale, service public fédéral | **gewestelijke administratie**, **gemeentebestuur**, **federale overheidsdienst** | Registre correct ? |

**Hiérarchie dans le jugement situationnel** : les choix actuels sont les suivants.

- Contexte belge : « diensthoofd » pour « chef de service », « teamleider » pour « chef(fe) d'équipe », « leidinggevende » pour « supérieur(e) ».
- Contexte européen (`critique-en-reunion`, Commission européenne) : « het hoofd van je eenheid » pour « cheffe d'unité ».

Ces termes sont-ils ceux de l'administration ?

**Villes** (`data/nl/numerique.json`, `centres-…`) : Brussel, Luik, Namen, Bergen.

## 3. Autres points incertains

### Nom et interface

- **Nom du site** : « Oefentests SELOR & EPSO ». Faut-il garder « SELOR », alors que le nom officiel est désormais Werkenvoor.be ? Le français garde aussi « SELOR ».
- **Tutoiement** : le site tutoie partout (« je »), dans un registre administratif.
  - Le « u » n'apparaît que dans des paroles citées : un agent qui s'adresse à un citoyen, une carte d'un soumissionnaire.
  - Le tutoiement convient-il à un public de candidats aux fonctions publiques ?
- **« tests »** partout, jamais « testen » : « redeneertests », « selectietests ». Un test le vérifie.
- **Menu et modules** :
  - « Mijn voortgang » (Ma progression), « Mijn fouten herbekijken » (Revoir mes erreurs) ;
  - « Examenmodus » et « proefexamen » (examen blanc) ;
  - « Situationeel beoordelen » (jugement situationnel), « meest / minst gepast » (plus / moins adéquate), « antwoordsleutel » (grille de correction).
- **Mention d'indépendance** : « De oefeningen zijn origineel en geïnspireerd op de formats van openbare selectietests. » La tournure « geïnspireerd op de formats » est-elle naturelle ?

### Raisonnement numérique (`data/nl/numerique.json`)

- **Unités** :
  - « mln euro » pour M€ et « duizend euro » pour k€ ;
  - euro devant le montant (« € 7,51 »), `%` collé au nombre (« 5,2% ») ;
  - « VTE » pour ETP ;
  - « procentpunt » ;
  - « op 20 » pour les notes sur 20.
- **Affichage en entier** : la projection des demandes au guichet (`canal-projection-guichet`) affiche « 47.500 aanvragen » au lieu de « 47,5 duizend ». Les données du graphique restent en milliers, comme l'indique la note.
- **Vocabulaire** :
  - « behandelingspercentage » (taux de traitement) ;
  - « doorlooptijd » (délai de traitement) ;
  - « verbruikspost » (poste de consommation d'énergie) ;
  - « gewone begroting » (budget ordinaire communal) ;
  - « gewogen gemiddelde » ;
  - « procentuele verandering ».
- **Prévision** : `centres-projection-namur` dit « Volgend jaar zou het aantal kandidaten … stijgen » pour « devrait augmenter ». Faut-il préférer « zal naar verwachting stijgen » ?

### Raisonnement verbal (`data/nl/verbal.json`)

- Dans les 60 affirmations, faire vérifier les quantificateurs : « de meeste », « alle », « sommige », « uitsluitend », « niet langer ».
  - La nuance doit rester la même qu'en français, sinon la bonne réponse ne tiendrait plus.
  - Les deux relectures déjà faites n'ont trouvé aucun cas, mais c'est le point le plus sensible.
