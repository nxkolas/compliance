import { defineFeatureMessages } from "@/src/i18n/define-messages";

export const legalPagesMessages = defineFeatureMessages({
  de: {
    legal: {
      footerNavigationLabel: "Rechtliche Informationen",
      privacy: {
        metadataTitle: "Datenschutz | ComplyX",
        metadataDescription:
          "Informationen zur Verarbeitung personenbezogener Daten bei ComplyX und zu Ihren Datenschutzrechten.",
        title: "Datenschutz",
        introduction:
          "Hier erfahren Sie, welche personenbezogenen Daten ComplyX verarbeitet, wofür sie verwendet werden und welche Rechte Sie haben.",
        sections: [
          {
            title: "Verantwortliche",
            blocks: [
              { type: "paragraph", text: "Gemeinsam verantwortlich für die Datenverarbeitung sind:" },
              { type: "subheading", text: "ComplyX – studentisches Projektteam" },
              { type: "lines", items: ["Melanie Kurmaschev", "Quynh Anh Dang", "Marie Meinhardt", "Nikolas Keller", "Eya Sdouga"] },
              { type: "lines", items: ["[Anschrift, die das Projektteam verwenden darf]", "[Postleitzahl und Ort]", "Deutschland"] },
              { type: "paragraph", text: "E-Mail: complyx.de@gmail.com" },
              { type: "paragraph", text: "Die genannten Personen haben eine Vereinbarung über die gemeinsame Verantwortlichkeit nach Art. 26 DSGVO geschlossen. Wesentlicher Inhalt dieser Vereinbarung:" },
              { type: "list", items: [
                "Die Zwecke und Mittel der Verarbeitung werden gemeinsam im Projektteam festgelegt.",
                "Die Erfüllung der Informationspflichten nach Art. 13 und 14 DSGVO erfolgt gemeinsam über diese Datenschutzerklärung.",
                "Anfragen betroffener Personen und die Erfüllung der Betroffenenrechte werden über die zentrale Anlaufstelle bearbeitet, unabhängig davon, an welches Teammitglied sich eine betroffene Person wendet.",
                "Betroffene Personen können ihre Rechte nach der DSGVO gegenüber jeder der genannten Personen geltend machen.",
              ] },
              { type: "paragraph", text: "Zentrale Anlaufstelle für alle Datenschutzanfragen und für die Ausübung Ihrer Rechte:" },
              { type: "strong", text: "complyx.de@gmail.com" },
            ],
          },
          {
            title: "Verarbeitete Daten und Zwecke",
            blocks: [
              { type: "paragraph", text: "ComplyX verarbeitet nur Daten, die für die Bereitstellung und Nutzung der Anwendung erforderlich sind. Abhängig von den verwendeten Funktionen können insbesondere folgende Daten verarbeitet werden:" },
              { type: "list", items: [
                "E-Mail-Adresse, Benutzerkennung und Anmeldedaten",
                "Organisations- und Profilangaben",
                "E-Mail-Adressen von Personen, die zu einer Organisation eingeladen werden, sowie Angaben zum Status der Einladung",
                "Antworten aus dem Betroffenheitscheck und der Gap-Analyse",
                "Ergebnisse, erkannte Sicherheitslücken und Maßnahmenpläne",
                "hochgeladene Dokumente einschließlich Dateiinhalten und Metadaten",
                "technische Zugriffsdaten wie IP-Adresse, Browser, Zeitpunkt des Zugriffs und Fehlermeldungen",
              ] },
              { type: "paragraph", text: "Die Daten werden verwendet, um Benutzerkonten bereitzustellen, Prüfungen durchzuführen, Ergebnisse zu speichern, Dokumente zu analysieren, Maßnahmenpläne zu erstellen, die gemeinsame Arbeit an einer Organisation zu ermöglichen und die Anwendung technisch abzusichern." },
              { type: "paragraph", text: "Unternehmensangaben können personenbezogen sein, wenn sie einer konkreten Person, Ansprechperson oder einem Einzelunternehmen zugeordnet werden können." },
              { type: "subheading", text: "Einladungen zu einer Organisation" },
              { type: "paragraph", text: "Nutzende Personen können weitere Personen über deren E-Mail-Adresse zu ihrer Organisation einladen. Wir verarbeiten diese E-Mail-Adresse, um die Einladung zuzustellen, ihren Status zu verwalten und den Zugang zur Organisation einzurichten. Die E-Mail-Adresse stammt nicht von der eingeladenen Person selbst, sondern von der einladenden Person aus der jeweiligen Organisation." },
              { type: "paragraph", text: "Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse besteht darin, die gemeinsame Nutzung einer Organisation innerhalb der Anwendung zu ermöglichen. Eingeladene Personen erhalten diese Informationen mit der Einladung und können der Verarbeitung jederzeit unter complyx.de@gmail.com widersprechen; die Einladungsdaten werden dann gelöscht." },
            ],
          },
          {
            title: "Supabase",
            blocks: [
              { type: "paragraph", text: "Für Authentifizierung, Datenbank, Backend und Dokumentenspeicherung verwenden wir Supabase. Das Projekt wird in der Region Central EU – Frankfurt betrieben. Supabase führt Frankfurt als europäische Projektregion." },
              { type: "paragraph", text: "Über Supabase werden insbesondere Benutzerkonten, Organisationsdaten, Antworten, Ergebnisse, Dokumente und Maßnahmenpläne gespeichert." },
              { type: "paragraph", text: "Hochgeladene Dokumente sollten nur Informationen enthalten, zu deren Verarbeitung Sie berechtigt sind. Nicht erforderliche personenbezogene oder besonders sensible Angaben sollten vor dem Upload entfernt oder anonymisiert werden." },
              { type: "subheading", text: "Verarbeitung im Auftrag bei hochgeladenen Dokumenten" },
              { type: "paragraph", text: "Enthalten hochgeladene Dokumente personenbezogene Daten Dritter, etwa von Beschäftigten, Ansprechpersonen oder Dienstleistern der nutzenden Organisation, bleibt die nutzende Organisation für diese Daten datenschutzrechtlich verantwortlich. ComplyX verarbeitet diese Daten insoweit ausschließlich weisungsgebunden im Auftrag nach Art. 28 DSGVO und nicht für eigene Zwecke." },
              { type: "paragraph", text: "Die nutzende Organisation entscheidet, welche Dokumente hochgeladen werden, und ist dafür verantwortlich, dass hierfür eine Rechtsgrundlage besteht und die betroffenen Personen nach Art. 13 und 14 DSGVO informiert werden." },
              { type: "paragraph", text: "Ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO ist vor der Nutzung dieser Funktion abzuschließen und kann unter complyx.de@gmail.com angefordert werden." },
              { type: "paragraph", text: "Betroffene Personen, deren Daten in hochgeladenen Dokumenten enthalten sind, wenden sich zur Ausübung ihrer Rechte vorrangig an die Organisation, die das Dokument hochgeladen hat. Anfragen, die uns erreichen, leiten wir an diese Organisation weiter." },
            ],
          },
          {
            title: "OpenAI API",
            blocks: [
              { type: "paragraph", text: "Für die Auswertung der Gap-Analyse, die Erstellung des Maßnahmenplans sowie für die Durchsuchbarkeit hochgeladener Dokumente verwenden wir die OpenAI API." },
              { type: "paragraph", text: "Dazu können folgende Informationen an OpenAI übermittelt werden:" },
              { type: "list", items: ["Antworten aus der Gap-Analyse", "erkannte Sicherheitslücken", "vorhandene Sicherheitsmaßnahmen", "notwendige Unternehmensangaben", "Inhalte hochgeladener Dokumente"] },
              { type: "paragraph", text: "Damit hochgeladene Dokumente durchsuchbar sind und passende Textstellen für die Analyse gefunden werden können, wird der Text eines hochgeladenen Dokuments in Abschnitte zerlegt und vollständig an ein Modell von OpenAI übermittelt, das daraus eine mathematische Repräsentation erzeugt. Dabei wird nicht nur ein Ausschnitt, sondern der gesamte Textinhalt des Dokuments verarbeitet. Für die anschließende Auswertung und die Erstellung des Maßnahmenplans werden nur die dafür erforderlichen Textstellen übermittelt." },
              { type: "paragraph", text: "Nach den Angaben von OpenAI werden Daten aus der API standardmäßig nicht zum Training oder zur Verbesserung der Modelle verwendet. Inhalte aus Anfragen und Antworten können grundsätzlich bis zu 30 Tage in Protokollen zur Missbrauchserkennung gespeichert werden, sofern keine abweichenden Einstellungen vereinbart wurden." },
              { type: "paragraph", text: "Für Daten aus dem Europäischen Wirtschaftsraum erfolgt die Verarbeitung nach dem OpenAI-Auftragsverarbeitungsvertrag über OpenAI Ireland Limited. Übermittlungen an Empfänger außerhalb des Europäischen Wirtschaftsraums werden nach Angaben von OpenAI insbesondere durch Standardvertragsklauseln oder einen Angemessenheitsbeschluss abgesichert." },
              { type: "paragraph", text: "KI-generierte Ergebnisse können unvollständig oder fehlerhaft sein. Sie dienen nur der ersten Orientierung und ersetzen keine Rechts- oder IT-Sicherheitsberatung." },
            ],
          },
          {
            title: "Hosting und technische Protokolle",
            blocks: [
              { type: "paragraph", text: "Während der Entwicklung kann ComplyX lokal auf Geräten des Projektteams ausgeführt werden. Die öffentlich erreichbare Testversion wird voraussichtlich über Vercel bereitgestellt." },
              { type: "paragraph", text: "Beim Aufruf können technische Daten wie IP-Adresse, Zeitpunkt, Browser, aufgerufene Seite sowie Fehler- und Sicherheitsmeldungen verarbeitet werden. Dies dient der Bereitstellung, Fehlerbehebung und Sicherheit der Anwendung." },
              { type: "paragraph", text: "Die Speicherdauer der Vercel-Runtime-Protokolle hängt vom verwendeten Tarif ab. Derzeit gelten unter anderem:" },
              { type: "list", items: ["Hobby: eine Stunde", "Pro: ein Tag", "Enterprise: drei Tage", "mit Observability Plus: bis zu 30 Tage"] },
              { type: "paragraph", text: "Vor Veröffentlichung muss der tatsächlich verwendete Tarif geprüft und hier nur die zutreffende Frist angegeben werden." },
            ],
          },
          {
            title: "Cookies und lokale Speicherung",
            blocks: [
              { type: "paragraph", text: "ComplyX verwendet ausschließlich technisch notwendige Cookies oder vergleichbare Speichertechniken. Diese werden beispielsweise benötigt, um:" },
              { type: "list", items: ["die Anmeldung aufrechtzuerhalten", "Sitzungsinformationen zu speichern", "geschützte Bereiche bereitzustellen", "den Bearbeitungsfortschritt oder Einstellungen zu sichern"] },
              { type: "paragraph", text: "Analyse-, Marketing- oder Werbe-Cookies werden derzeit nicht eingesetzt." },
              { type: "paragraph", text: "Rechtsgrundlage für die Speicherung von Informationen auf Ihrem Endgerät und den Zugriff darauf ist § 25 Abs. 2 Nr. 2 TDDDG. Der Zugriff ist unbedingt erforderlich, damit wir den von Ihnen ausdrücklich gewünschten Dienst, insbesondere die Anmeldung und die geschützten Bereiche, bereitstellen können. Eine Einwilligung ist hierfür nicht erforderlich. Die anschließende Verarbeitung der so erhobenen personenbezogenen Daten richtet sich nach Abschnitt 7." },
              { type: "paragraph", text: "Für technisch nicht erforderliche Cookies wäre nach § 25 Abs. 1 TDDDG grundsätzlich eine vorherige Einwilligung notwendig. Ausgenommen sind Speicherzugriffe, die unbedingt erforderlich sind, um einen ausdrücklich gewünschten digitalen Dienst bereitzustellen." },
            ],
          },
          {
            title: "Rechtsgrundlagen",
            blocks: [
              { type: "paragraph", text: "Die Verarbeitung erfolgt insbesondere auf folgenden Grundlagen:" },
              { type: "list", items: [
                "Art. 6 Abs. 1 lit. b DSGVO, soweit die Daten zur Registrierung, Durchführung der Checks, Dokumentenanalyse, Speicherung der Ergebnisse oder Erstellung des Maßnahmenplans erforderlich sind.",
                "Art. 6 Abs. 1 lit. f DSGVO, soweit die Verarbeitung dem sicheren, stabilen und fehlerfreien Betrieb der Anwendung dient oder der Zusammenarbeit mehrerer Personen innerhalb einer Organisation, insbesondere dem Versand von Einladungen.",
              ] },
              { type: "paragraph", text: "Der Dokumentenupload ist freiwillig. Ohne die für Registrierung und Prüfung erforderlichen Angaben können die entsprechenden Funktionen nicht bereitgestellt werden." },
            ],
          },
          {
            title: "Speicherdauer",
            blocks: [
              { type: "paragraph", text: "Für die im Rahmen von ComplyX verarbeiteten Prüfungsdaten besteht keine allgemeine gesetzliche Mindestaufbewahrungsfrist. Die Daten dürfen nur so lange gespeichert werden, wie sie für den jeweiligen Zweck benötigt werden." },
              { type: "paragraph", text: "Für ComplyX gelten folgende Löschregeln:" },
              { type: "list", items: [
                "Benutzerkonten, Organisationsdaten, Antworten, Ergebnisse, Dokumente und Maßnahmenpläne werden bis zur Löschung durch die nutzende Person, bis zur Löschung des Kontos oder bis zum Ende des Hochschulprojekts gespeichert.",
                "Nach Abschluss des Projekts werden diese Daten innerhalb von 30 Tagen gelöscht. Restkopien können bis zur planmäßigen Überschreibung technischer Sicherungskopien bestehen bleiben.",
                "Bei OpenAI können API-Inhalte grundsätzlich bis zu 30 Tage gespeichert werden. Für Vercel gelten die im vorherigen Abschnitt genannten tarifabhängigen Fristen.",
              ] },
            ],
          },
          {
            title: "Empfänger und Drittlandübermittlungen",
            blocks: [
              { type: "paragraph", text: "Daten werden nur an Dienstleister übermittelt, die für den Betrieb der Anwendung erforderlich sind:" },
              { type: "list", items: ["Supabase Inc., Vereinigte Staaten, für Authentifizierung, Datenbank und Dokumentenspeicherung", "OpenAI Ireland Limited, Irland, für die KI-gestützte Auswertung", "Vercel Inc., Vereinigte Staaten, für das Hosting der Testversion"] },
              { type: "paragraph", text: "Eine Weitergabe zu Werbezwecken erfolgt nicht." },
              { type: "paragraph", text: "Supabase und Vercel sind Unternehmen mit Sitz in den Vereinigten Staaten. Auch wenn die Speicherung im Fall von Supabase in der Region Frankfurt erfolgt, kann ein Zugriff aus den Vereinigten Staaten, etwa im Rahmen von Support oder Administration, nicht ausgeschlossen werden." },
              { type: "paragraph", text: "Soweit Dienstleister Daten außerhalb der Europäischen Union oder des Europäischen Wirtschaftsraums verarbeiten, erfolgt dies nach Maßgabe der gesetzlichen Voraussetzungen, beispielsweise auf Grundlage eines Angemessenheitsbeschlusses oder von Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO." },
              { type: "paragraph", text: "Eine Kopie der jeweiligen Garantien, insbesondere der abgeschlossenen Standardvertragsklauseln, können Sie unter complyx.de@gmail.com anfordern." },
            ],
          },
          {
            title: "Automatisierte Entscheidungen",
            blocks: [
              { type: "paragraph", text: "Die OpenAI API unterstützt die Analyse und die Erstellung von Empfehlungen." },
              { type: "paragraph", text: "Es findet keine ausschließlich automatisierte Entscheidung statt, die gegenüber einer natürlichen Person rechtliche oder vergleichbar erhebliche Auswirkungen entfaltet. Die Ergebnisse stellen keine verbindliche Feststellung der NIS2-Betroffenheit oder NIS2-Compliance dar." },
            ],
          },
          {
            title: "Ihre Rechte",
            blocks: [
              { type: "paragraph", text: "Sie haben nach den gesetzlichen Voraussetzungen insbesondere das Recht auf:" },
              { type: "list", items: ["Auskunft und Berichtigung", "Löschung und Einschränkung der Verarbeitung", "Datenübertragbarkeit", "Widerspruch gegen bestimmte Verarbeitungen", "Widerruf einer erteilten Einwilligung", "Beschwerde bei einer Datenschutzaufsichtsbehörde"] },
              { type: "paragraph", text: "Zur Ausübung Ihrer Rechte wenden Sie sich an:" },
              { type: "strong", text: "complyx.de@gmail.com" },
              { type: "subheading", text: "Widerspruchsrecht nach Art. 21 DSGVO" },
              { type: "paragraph", text: "Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung Sie betreffender personenbezogener Daten Widerspruch einzulegen, die auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO erfolgt. Das betrifft insbesondere die Verarbeitung zum sicheren und fehlerfreien Betrieb der Anwendung und den Versand von Einladungen." },
              { type: "paragraph", text: "Legen Sie Widerspruch ein, verarbeiten wir die betroffenen Daten nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen." },
              { type: "paragraph", text: "Der Widerspruch ist formfrei möglich und kann an complyx.de@gmail.com gerichtet werden." },
            ],
          },
          {
            title: "Datensicherheit und Änderungen",
            blocks: [
              { type: "paragraph", text: "Wir setzen angemessene technische und organisatorische Maßnahmen ein, um Daten vor Verlust, Veränderung, unbefugtem Zugriff und unberechtigter Weitergabe zu schützen. Dazu gehören insbesondere verschlüsselte Übertragung, geschützte Benutzerkonten und Zugriffsbeschränkungen." },
              { type: "paragraph", text: "Diese Datenschutzerklärung wird angepasst, wenn sich Funktionen, Dienstleister oder rechtliche Anforderungen ändern." },
              { type: "strong", text: "Stand: August 2026" },
            ],
          },
        ],
      },
      imprint: {
        metadataTitle: "Impressum | ComplyX",
        metadataDescription:
          "Gesetzlich vorgeschriebene Anbieterangaben und Kontaktmöglichkeiten von ComplyX.",
        title: "Impressum",
        introduction:
          "Hier finden Sie die gesetzlich vorgeschriebenen Angaben zum Anbieter von ComplyX sowie unsere Kontaktmöglichkeiten. Die Angaben erfolgen gemäß § 5 DDG und § 18 MStV.",
        provider: {
          title: "Anbieter",
          teamName: "ComplyX (studentisches Projektteam)",
          members: [
            "Melanie Kurmaschev",
            "Quynh Anh Dang",
            "Marie Meinhardt",
            "Nikolas Keller",
            "Eya Sdouga",
          ],
          institution: "Technische Hochschule Würzburg-Schweinfurt",
          street: "Sanderheinrichsleitenweg 20",
          city: "97074 Würzburg",
        },
        contact: {
          title: "Kontakt",
          emailLabel: "E-Mail:",
          email: "complyxx@gmail.com",
          phoneLabel: "Telefon:",
          phone: "+49 152 08198263",
          websiteLabel: "Website:",
        },
        project: {
          title: "Angaben zum Projekt",
          paragraphs: [
            "ComplyX ist ein studentisches Projekt, das im Rahmen eines Hochschulprojekts an der Technischen Hochschule Würzburg-Schweinfurt",
            "im Sommersemester 2026 entwickelt wurde.",
            "Die Anwendung unterstützt Unternehmen dabei, sich einen ersten Überblick über eine mögliche NIS2-Betroffenheit, den bestehenden Stand ihrer IT-Sicherheit und mögliche nächste Schritte zu verschaffen.",
            "ComplyX ist ein prototypisches Projekt und kein offizielles Angebot der Technischen Hochschule Würzburg-Schweinfurt.",
          ],
        },
        usage: {
          title: "Hinweise zur Nutzung",
          paragraphs: [
            "Die über ComplyX bereitgestellten Inhalte und Ergebnisse dienen ausschließlich der allgemeinen Information und einer ersten Orientierung.",
            "Sie stellen insbesondere keine Rechtsberatung, keine IT-Sicherheitsberatung, keine Zertifizierung und keine verbindliche Prüfung der NIS2-Betroffenheit oder NIS2-Compliance dar.",
            "Die Ergebnisse beruhen auf den von den Nutzenden eingegebenen Informationen und gegebenenfalls bereitgestellten Dokumenten.",
            "Für eine verbindliche Beurteilung sollten qualifizierte Rechts- oder IT-Sicherheitsfachstellen hinzugezogen werden.",
          ],
        },
        liability: {
          title: "Haftungsausschluss",
          paragraphs: [
            "Die Inhalte dieser Anwendung wurden mit größter Sorgfalt erstellt.",
            "Dennoch kann keine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität der bereitgestellten Inhalte und Ergebnisse übernommen werden.",
            "Die Nutzung der Anwendung und der daraus abgeleiteten Ergebnisse erfolgt in eigener Verantwortung. Die Haftung der Anbieterinnen und Anbieter richtet sich nach den gesetzlichen Vorschriften. Zwingende gesetzliche Haftungsregelungen bleiben unberührt.",
          ],
        },
      },
    },
  },
  en: {
    legal: {
      footerNavigationLabel: "Legal information",
      privacy: {
        metadataTitle: "Privacy | ComplyX",
        metadataDescription:
          "Information about how ComplyX processes personal data and about your data protection rights.",
        title: "Privacy",
        introduction:
          "Learn which personal data ComplyX processes, what it is used for, and which rights you have.",
        sections: [
          {
            title: "Controllers",
            blocks: [
              { type: "paragraph", text: "The following persons are joint controllers for the processing of personal data:" },
              { type: "subheading", text: "ComplyX – student project team" },
              { type: "lines", items: ["Melanie Kurmaschev", "Quynh Anh Dang", "Marie Meinhardt", "Nikolas Keller", "Eya Sdouga"] },
              { type: "lines", items: ["[Address that the project team may use]", "[Postal code and city]", "Germany"] },
              { type: "paragraph", text: "Email: complyx.de@gmail.com" },
              { type: "paragraph", text: "The persons named above have entered into an arrangement on joint controllership under Article 26 GDPR. Its essential content is as follows:" },
              { type: "list", items: [
                "The purposes and means of processing are determined jointly by the project team.",
                "The information obligations under Articles 13 and 14 GDPR are fulfilled jointly through this privacy policy.",
                "Data subject requests and the exercise of data subject rights are handled through the central contact point, regardless of which team member is contacted.",
                "Data subjects may exercise their GDPR rights against any of the persons named above.",
              ] },
              { type: "paragraph", text: "Central contact point for all privacy enquiries and for exercising your rights:" },
              { type: "strong", text: "complyx.de@gmail.com" },
            ],
          },
          {
            title: "Data processed and purposes",
            blocks: [
              { type: "paragraph", text: "ComplyX only processes data required to provide and use the application. Depending on the functions used, this may include:" },
              { type: "list", items: [
                "email address, user identifier, and login data",
                "organization and profile information",
                "email addresses of people invited to an organization and information about invitation status",
                "answers from the applicability check and gap analysis",
                "results, identified security gaps, and action plans",
                "uploaded documents, including file contents and metadata",
                "technical access data such as IP address, browser, access time, and error messages",
              ] },
              { type: "paragraph", text: "The data is used to provide user accounts, conduct checks, store results, analyze documents, create action plans, enable collaboration within an organization, and secure the application technically." },
              { type: "paragraph", text: "Company information may be personal data when it can be linked to a specific person, contact person, or sole proprietorship." },
              { type: "subheading", text: "Invitations to an organization" },
              { type: "paragraph", text: "Users can invite other people to their organization using their email address. We process this email address to deliver the invitation, manage its status, and set up access to the organization. The email address is provided by the inviting person in the organization rather than by the invited person." },
              { type: "paragraph", text: "The legal basis is Article 6(1)(f) GDPR. The legitimate interest is to enable collaborative use of an organization within the application. Invited persons receive this information with the invitation and may object to the processing at any time by contacting complyx.de@gmail.com; the invitation data will then be deleted." },
            ],
          },
          {
            title: "Supabase",
            blocks: [
              { type: "paragraph", text: "We use Supabase for authentication, the database, backend services, and document storage. The project runs in the Central EU – Frankfurt region, which Supabase lists as a European project region." },
              { type: "paragraph", text: "Supabase stores user accounts, organization data, answers, results, documents, and action plans in particular." },
              { type: "paragraph", text: "Uploaded documents should only contain information that you are authorized to process. Personal data that is not required, and particularly sensitive information, should be removed or anonymized before upload." },
              { type: "subheading", text: "Processing on behalf of users for uploaded documents" },
              { type: "paragraph", text: "Where uploaded documents contain personal data of third parties, such as employees, contacts, or service providers of the using organization, that organization remains responsible for the data under data protection law. In this respect, ComplyX processes the data solely on documented instructions as a processor under Article 28 GDPR and not for its own purposes." },
              { type: "paragraph", text: "The using organization decides which documents are uploaded and is responsible for ensuring that a legal basis exists and that data subjects are informed under Articles 13 and 14 GDPR." },
              { type: "paragraph", text: "A data processing agreement under Article 28 GDPR must be concluded before this function is used and can be requested at complyx.de@gmail.com." },
              { type: "paragraph", text: "Data subjects whose data is contained in uploaded documents should primarily contact the organization that uploaded the document to exercise their rights. We forward requests received by us to that organization." },
            ],
          },
          {
            title: "OpenAI API",
            blocks: [
              { type: "paragraph", text: "We use the OpenAI API to evaluate the gap analysis, create the action plan, and make uploaded documents searchable." },
              { type: "paragraph", text: "The following information may be transmitted to OpenAI:" },
              { type: "list", items: ["answers from the gap analysis", "identified security gaps", "existing security measures", "required company information", "contents of uploaded documents"] },
              { type: "paragraph", text: "To make uploaded documents searchable and find suitable passages for analysis, the text of an uploaded document is divided into sections and transmitted in full to an OpenAI model, which creates a mathematical representation. The entire text content, rather than only an excerpt, is processed for this purpose. Only the passages required for the subsequent evaluation and creation of the action plan are transmitted for those steps." },
              { type: "paragraph", text: "According to OpenAI, API data is not used to train or improve models by default. Content from requests and responses may generally be retained for up to 30 days in abuse-monitoring logs unless different settings have been agreed." },
              { type: "paragraph", text: "For data from the European Economic Area, processing is carried out under OpenAI's data processing agreement through OpenAI Ireland Limited. According to OpenAI, transfers to recipients outside the European Economic Area are safeguarded in particular by standard contractual clauses or an adequacy decision." },
              { type: "paragraph", text: "AI-generated results may be incomplete or incorrect. They provide initial guidance only and do not replace legal or IT security advice." },
            ],
          },
          {
            title: "Hosting and technical logs",
            blocks: [
              { type: "paragraph", text: "During development, ComplyX may run locally on devices used by the project team. The publicly accessible test version is expected to be provided through Vercel." },
              { type: "paragraph", text: "Technical data such as IP address, time, browser, page accessed, and error or security messages may be processed when the application is accessed. This serves to provide, troubleshoot, and secure the application." },
              { type: "paragraph", text: "The retention period for Vercel runtime logs depends on the plan used. Current examples include:" },
              { type: "list", items: ["Hobby: one hour", "Pro: one day", "Enterprise: three days", "with Observability Plus: up to 30 days"] },
              { type: "paragraph", text: "Before publication, the plan actually used must be checked and only the applicable retention period stated here." },
            ],
          },
          {
            title: "Cookies and local storage",
            blocks: [
              { type: "paragraph", text: "ComplyX uses only cookies or comparable storage technologies that are technically necessary. They are required, for example, to:" },
              { type: "list", items: ["keep users signed in", "store session information", "provide protected areas", "save progress or settings"] },
              { type: "paragraph", text: "Analytics, marketing, or advertising cookies are currently not used." },
              { type: "paragraph", text: "The legal basis for storing information on your device and accessing it is Section 25(2)(2) TDDDG. Access is strictly necessary to provide the digital service you expressly request, in particular login and protected areas. Consent is not required for this. Subsequent processing of the personal data collected in this way is governed by section 7." },
              { type: "paragraph", text: "Cookies that are not technically necessary would generally require prior consent under Section 25(1) TDDDG. Storage access that is strictly necessary to provide an expressly requested digital service is exempt." },
            ],
          },
          {
            title: "Legal bases",
            blocks: [
              { type: "paragraph", text: "Processing is carried out in particular on the following legal bases:" },
              { type: "list", items: [
                "Article 6(1)(b) GDPR where the data is required for registration, conducting checks, document analysis, storing results, or creating the action plan.",
                "Article 6(1)(f) GDPR where processing serves the secure, stable, and error-free operation of the application or collaboration between several people within an organization, in particular sending invitations.",
              ] },
              { type: "paragraph", text: "Uploading documents is voluntary. Without the information required for registration and checks, the corresponding functions cannot be provided." },
            ],
          },
          {
            title: "Retention periods",
            blocks: [
              { type: "paragraph", text: "There is no general statutory minimum retention period for check data processed through ComplyX. Data may only be stored for as long as it is required for the respective purpose." },
              { type: "paragraph", text: "The following deletion rules apply to ComplyX:" },
              { type: "list", items: [
                "User accounts, organization data, answers, results, documents, and action plans are stored until deleted by the user, until the account is deleted, or until the university project ends.",
                "After the project ends, this data will be deleted within 30 days. Residual copies may remain until technical backups are overwritten as scheduled.",
                "OpenAI API content may generally be retained for up to 30 days. The plan-dependent periods stated in the previous section apply to Vercel.",
              ] },
            ],
          },
          {
            title: "Recipients and international transfers",
            blocks: [
              { type: "paragraph", text: "Data is transferred only to service providers required to operate the application:" },
              { type: "list", items: ["Supabase Inc., United States, for authentication, database, and document storage", "OpenAI Ireland Limited, Ireland, for AI-assisted evaluation", "Vercel Inc., United States, for hosting the test version"] },
              { type: "paragraph", text: "Data is not shared for advertising purposes." },
              { type: "paragraph", text: "Supabase and Vercel are companies based in the United States. Although Supabase storage is located in the Frankfurt region, access from the United States, for example for support or administration, cannot be ruled out." },
              { type: "paragraph", text: "Where service providers process data outside the European Union or European Economic Area, this is done in accordance with statutory requirements, for example on the basis of an adequacy decision or standard contractual clauses under Article 46(2)(c) GDPR." },
              { type: "paragraph", text: "You can request a copy of the relevant safeguards, in particular the concluded standard contractual clauses, at complyx.de@gmail.com." },
            ],
          },
          {
            title: "Automated decisions",
            blocks: [
              { type: "paragraph", text: "The OpenAI API supports analysis and the creation of recommendations." },
              { type: "paragraph", text: "No decision based solely on automated processing takes place that produces legal or similarly significant effects for a natural person. The results do not constitute a binding determination of NIS2 applicability or NIS2 compliance." },
            ],
          },
          {
            title: "Your rights",
            blocks: [
              { type: "paragraph", text: "Subject to the statutory requirements, you have in particular the right to:" },
              { type: "list", items: ["access and rectification", "erasure and restriction of processing", "data portability", "object to certain processing", "withdraw consent that has been given", "lodge a complaint with a data protection supervisory authority"] },
              { type: "paragraph", text: "To exercise your rights, please contact:" },
              { type: "strong", text: "complyx.de@gmail.com" },
              { type: "subheading", text: "Right to object under Article 21 GDPR" },
              { type: "paragraph", text: "You have the right, on grounds relating to your particular situation, to object at any time to processing of your personal data based on Article 6(1)(f) GDPR. This applies in particular to processing for the secure and error-free operation of the application and to sending invitations." },
              { type: "paragraph", text: "If you object, we will no longer process the data concerned unless we can demonstrate compelling legitimate grounds that override your interests, rights, and freedoms, or the processing serves to establish, exercise, or defend legal claims." },
              { type: "paragraph", text: "The objection can be made informally and sent to complyx.de@gmail.com." },
            ],
          },
          {
            title: "Data security and changes",
            blocks: [
              { type: "paragraph", text: "We use appropriate technical and organizational measures to protect data against loss, alteration, unauthorized access, and unauthorized disclosure. These include encrypted transmission, protected user accounts, and access restrictions." },
              { type: "paragraph", text: "This privacy policy will be updated when functions, service providers, or legal requirements change." },
              { type: "strong", text: "Last updated: August 2026" },
            ],
          },
        ],
      },
      imprint: {
        metadataTitle: "Legal notice | ComplyX",
        metadataDescription:
          "Legally required provider information and contact details for ComplyX.",
        title: "Legal notice",
        introduction:
          "This page contains the legally required information about the provider of ComplyX and our contact details. The information is provided in accordance with Section 5 DDG and Section 18 MStV.",
        provider: {
          title: "Provider",
          teamName: "ComplyX (student project team)",
          members: [
            "Melanie Kurmaschev",
            "Quynh Anh Dang",
            "Marie Meinhardt",
            "Nikolas Keller",
            "Eya Sdouga",
          ],
          institution: "Technical University of Applied Sciences Würzburg-Schweinfurt",
          street: "Sanderheinrichsleitenweg 20",
          city: "97074 Würzburg, Germany",
        },
        contact: {
          title: "Contact",
          emailLabel: "Email:",
          email: "complyxx@gmail.com",
          phoneLabel: "Telephone:",
          phone: "+49 152 08198263",
          websiteLabel: "Website:",
        },
        project: {
          title: "Project information",
          paragraphs: [
            "ComplyX is a student project developed as part of a university project at the Technical University of Applied Sciences Würzburg-Schweinfurt during the 2026 summer semester.",
            "The application helps organizations obtain an initial overview of whether they may be affected by NIS2, the current state of their IT security, and possible next steps.",
            "ComplyX is a prototype project and not an official service of the Technical University of Applied Sciences Würzburg-Schweinfurt.",
          ],
        },
        usage: {
          title: "Usage information",
          paragraphs: [
            "The content and results provided through ComplyX are intended solely for general information and initial guidance.",
            "In particular, they do not constitute legal advice, IT security consulting, certification, or a binding assessment of NIS2 applicability or NIS2 compliance.",
            "The results are based on information entered by users and any documents they provide. Qualified legal or IT security professionals should be consulted for a binding assessment.",
          ],
        },
        liability: {
          title: "Disclaimer",
          paragraphs: [
            "The content of this application has been prepared with the greatest possible care. Nevertheless, no guarantee can be given for the accuracy, completeness, or timeliness of the content and results provided.",
            "Use of the application and any results derived from it is at the user's own responsibility. The liability of the providers is governed by statutory provisions. Mandatory statutory liability rules remain unaffected.",
          ],
        },
      },
    },
  },
});
