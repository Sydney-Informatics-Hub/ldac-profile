const { validateEntity, resolveType } = require('./validator');

const { CollectionProfileUrl, ObjectProfileUrl } = require('./constants');

function isValidUrl(urlStr) {
  try {
    let url = new URL(urlStr);
    return true;
  } catch (e) {}
  return false;
}

const Common = {
  '@id': {
    clause:
      'MUST have an @id property and the value must be a valid URI or "./"',
    validate: function ({ error }, id) {
      if (id) {
        if (!isValidUrl(id) && id != './')
          error('The value of @id is not a valid URI');
      } else {
        error('There is no @id property');
      }
    },
  },
  name: {
    clause:
      'MUST have a single name value which is a string with one or more characters',
    validate: function ({ error }, name) {
      if (name && name.length) {
        if (name.length > 1) error('There is more than one name');
        else {
          if (typeof name[0] !== 'string') error('Value is not a string');
          else if (name[0].length === 0)
            error('Value must have one or more characters');
        }
      } else {
        error('There is no name property');
      }
    },
  },
  inLanguage: {
    clause:
      'MAY have an `inLanguage` property which is a reference to one or more Language items',
    validate: function ({ error, info, results }, values, entity, crate) {
      if (!values || !values.length) {
        info('Does not have an `inLanguage` property');
        return;
      }
      info('Does have an `inLanguage` property');
      for (let lg of values) {
        validateEntity(rules.Language, lg, crate, results);
      }
    },
  },
  subjectLanguage: {
    clause:
      'MAY have a `subjectLanguage` property which is a reference to one or more Language items',
    validate: function ({ error, info, results }, values, entity, crate) {
      if (!values || !values.length) {
        info('Does not have a `subjectLanguage` property');
        return;
      }
      info('Does have a `subjectLanguage` property');
      for (let lg of values) {
        validateEntity(rules.Language, lg, crate, results);
      }
    },
  },
  contentLocation: {
    clause:
      'MAY have a `contentLocation` property which is a reference to one or more `Place` items',
    validate: function ({ error, info, results }, values, entity, crate) {
      if (!values || !values.length) {
        info('Does not have a `contentLocation` property');
        return;
      }
      info('Does have a `contentLocation` property');
      /*
      TODO -- valdidate contentLocations
      for (let v of values) {
        validateEntity(rules.Place, lg, crate, results);
      }
      */
    },
  },
};

const License = {
  license: {
    clause:
      'MUST have a `license` property with reference to an entity of type [File, DataReuseLicense] with an `@id` property that starts with `LICENSE` and a `URL` property that is a valid URL',
    validate: function ({ error, info, results }, values, entity, crate) {
      var foundAReuseLicense = false;
      if (!values) {
        error(`Does not have a license property`);
        return;
      }
      for (let v of values) {
        if (v['@id']) {
          // We have a promising match - check that this is a
          const licenseFile = crate.getEntity(v['@id']);
          var thisLicenseLooksOK = true;
          if (!v['@id'].match(/^LICENSE/)) {
            error(`License @id does not start with LICENSE`);
          }
          if (!licenseFile) {
            error(`License property does not reference a licence file`);
            thisLicenseLooksOK = false;
          } else {
            if (!licenseFile['@type'].includes('File')) {
              error(
                `There is a reference to a LICENSE entity but it does not have "File" as a type value: ${JSON.stringify(
                  v
                )}`
              );
              thisLicenseLooksOK = false;
            }
            if (!licenseFile['@type'].includes('DataReuseLicense')) {
              error(
                `There is a reference to a LICENSE entity but it does not have "DataReuseLicense" as a @type value: ${JSON.stringify(
                  v
                )}`
              );
              thisLicenseLooksOK = false;
            }
            if (
              !isValidUrl(licenseFile['URL']) &&
              !isValidUrl(licenseFile['@id']['URL'])
            ) {
              error(
                `There is a reference to a LICENSE entity but it does not have a \`URL\` property which is a well-formed URL: ${JSON.stringify(
                  v
                )}`
              );
              thisLicenseLooksOK = false;
            }
          }
          foundAReuseLicense = foundAReuseLicense || thisLicenseLooksOK;
        }
      }
    },
  },
};

const Dataset = {
  '@type': {
    clause:
      'MUST have a `@type` attribute that that includes in its values `Dataset` and either `RepositoryCollection` or `RepositoryObject`',
    validate: function ({ error, info, warn, results }, values, entity, crate) {
      var type;
      const types = new Set(values);
      if (!types.has('Dataset')) error(' MUST include a "Dataset"');
      if (types.has('RepositoryCollection')) type = 'RepositoryCollection';
      if (types.has('RepositoryObject')) {
        if (type) {
          error(
            'MUST NOT have both `RepositoryCollection` and `RepositoryObject` as values in `@type`'
          );
        } else {
          type = 'RepositoryObject';
        }
      }
      if (!type) {
        error(
          'MUST have `RepositoryCollection` or `RepositoryObject` as values in `@type`'
        );
        type = 'Common';
      }
      // Some overall rules

      Dataset._propertyNames.validate(
        { results, error, warn, info },
        null,
        null,
        crate
      );
      validateEntity(rules[type], entity, crate, results);
    },
  },
  conformsTo: {
    clause: `MUST have a conformsTo which references the profile URL for either a Collection (${CollectionProfileUrl}) or an Object (${ObjectProfileUrl}) but not both`,
    validate: function ({ error }, values, entity, crate) {
      if (!values || !values.length)
        return error('Does not have conformsTo' + values);
      var urls = new Set(values.map((e) => e['@id']));
      if (urls.has(CollectionProfileUrl) && urls.has(ObjectProfileUrl))
        error('Cannot have both Collection and Object profiles');
      else if (!urls.has(CollectionProfileUrl) && !urls.has(ObjectProfileUrl))
        error('Does not conform to this profile');
    },
  },
  license: License.license,
 

  datePublished: {
    //cardinality: '1',
    clause:
      'MUST have  a `datePublished` property (per RO-Crate) exactly one value which is a string that parses as ISO-8601 to the level of at least a year. E.g.: 2000, 2000-10, 2000-10-01T12:34:56+10',
    validate: function ({ error }, datePublished) {
      if (
        !datePublished ||
        !datePublished.length === 1 ||
        isNaN(Date.parse(datePublished[0]))
      ) {
        error();
      }
    },
  },

  publisher: {
    clause:
      'MUST have a `publisher` property (per RO-Crate) which MUST have an ID which is a URL\n',
    validate({ error, info, results }, values) {
      if (!values || !values.length) {
        error('Does not have a Publisher');
        return;
      }
      if (!isValidUrl(values[0]['@id'])) error('Publisher @id is not a URL');
    },
  },
  _propertyNames: {
    clause:
      'SHOULD have property names which resolve using the supplied context',
    validate: function ({ results, error, warn, info }, prop, entity, crate) {
      const propsSeen = {};
      for (let item of crate.getGraph()) {
        for (let prop of Object.keys(item)) {
          if (!propsSeen[prop] && !['@id', '@type'].includes(prop)) {
            if (!crate.resolveTerm(prop)) {
              warn(
                `Property \`${prop}\` is not defined in the crate's context`
              );
            }
          }
          propsSeen[prop] = true;
        }
      }
    },
  },
};



const RepositoryCollection = {
  '@id': Common['@id'],
  '@type': {
    clause:
      'MUST have a type value of “RepositoryCollection” and MUST NOT have a type of “RepositoryObject”',
    validate: function ({ error }, values) {
      const types = new Set(values);
      if (!types.has('RepositoryCollection'))
        error('@type MUST include “RepositoryCollection”');
      if (types.has('RepositoryObject'))
        error('@type MUST NOT include “RepositoryObject”');
    },
  },
  name: Common.name,

  conformsTo: {
    clause:
      'MUST have a conformsTo which references the Collection profile URL',
    validate: function ({ error }, values, entity, crate) {
      if (!values || !values.length) return error('Does not have conformsTo ');
      var urls = new Set(values.map((e) => e['@id']));
      if (!urls.has(CollectionProfileUrl)) error();
      if (urls.has(ObjectProfileUrl)) error('MUST NOT have Object profile');
    },
  },
  description: {
    clause:
      'MUST have at least one `description` value which is a string with one or more characters',
    validate: function ({ error }, description) {
      if (!description || !description.length || !description[0].length)
        error();
    },
  },
  hasMember: {
    clause:
      'MAY have one or more references to Collection or Object entities, which may be included in the crate or have MUST have @id properties which are URIs',
    validate({ error, info, results }, values, entity, crate) {
      if (!values || !values.length) return info();
      for (const member of values) {
        const id = member['@id'];
        // TODO - complain if no ID
        if (id && crate.getItem(id)) {
          const mem = crate.getEntity(id);
          if (mem) {
            let type =
              resolveType(['RepositoryCollection', 'RepositoryObject'], mem) ||
              'Common';

            if (!type)
              error(
                `Embedded entities in hasMember MUST include either one of “RepositoryCollection” or “RepositoryObject” (${id} does not)`
              );
            validateEntity(rules[type], member, crate, results);
            // rules;
          }
        } else {
          if (!isValidUrl(member['@id']))
            error(
              `hasMember @id is not in this crate and is not a URL (${id}) `
            );
        }
      }
    },
  },
  communicationMode: {
    clause:
      'MAY have a `communicationMode` property which SHOULD be a reference to one or more of the Language Data Commons Communication Mode Terms: SpokenLanguage,  WrittenLanguage,  Song,  Gesture,  SignedLanguage,  WhistledLanguage (this information may be summarisable from collection members)',
    validate({ error, info, warn, results }, values, entity, crate) {
      if (!values || values.length === 0) {
        info('Does not have a communicationMode property');
        return;
      }
      modalities = [
        'http://purl.archive.org/language-data-commons/terms#SpokenLanguage',
        'http://purl.archive.org/language-data-commons/terms#WrittenLanguage',
        'http://purl.archive.org/language-data-commons/terms#Song',
        'http://purl.archive.org/language-data-commons/terms#Gesture',
        'http://purl.archive.org/language-data-commons/terms#SignedLanguage',
        'http://purl.archive.org/language-data-commons/terms#WhistledLanguage',
      ];

      info('DOES have a `communicationMode` property');
      for (m of values) {
        if (!modalities.includes(m['@id'])) {
          warn(`communicationMode value is not expected: ${JSON.stringify(m)}`);
        }
      }
    },
  },

  linguisticGenre: {
    clause:
      'MAY have a `linguisticGenre` property which is a reference to one or more of the Langauge Data Commons LinguistGenre Terms:  Formulaic, Thesaurus, Dialogue, Oratory, Report, Ludic, Procedural, Narrative, Interview, Drama, Informational (this information may be summarisable from collection members)',
    validate({ error, info, results }, values) {
      if (!values || !values.length) {
        info('Does not have a linguistic genre');
        return;
      }
      report('DOES have a `linguisticGenre` property');
      // TODO: Validate it
    },
  },
  inLanguage: Common.inLanguage,
  subjectLanguage: Common.subjectLanguage,
  contentLocation: Common.contentLocation,
  dateFreeText: {
    clause: 'MAY have a `dateFreeText` property',
    validate({ error, info, results }, values) {
      if (!values || !values.length) {
        info('Does not have a dateFreeText');
      } else {
        info('Does have a dateFreeText');
        for (v of values) {
          if (typeof v !== 'string') warn('dateFreeText value is not a string');
        }
      }
    }
  }
};

const LanguageDataTypes = {
  // Optional Data types for distinguishing between materials
  PrimaryMaterial: {
    clause:
      'SHOULD have a hasPart referencing an item of @type File with an addition @type value  of PrimaryMaterial',
  },
  Annotation: {
    clause:
      'MAY have a hasPart referencing an item of @type File with an addition @type value  of Annotation',
  },
  DerivedMaterial: {
    clause:
      'MAY have a hasPart referencing an item of @type File with an addition @type value  of DerivedMaterial',
  },
};

const RepositoryObject = {
  conformsTo: {
    clause: 'MUST have a conformsTo which references the Object profile URL',
    validate: function ({ error }, values, entity, crate) {
      if (!values || !values.length)
        return error('Does not have conformsTo ${values}');
      var urls = new Set(values.map((e) => e['@id']));
      if (!urls.has(ObjectProfileUrl)) error();
      if (urls.has(CollectionProfileUrl))
        error('MUST NOT have Collection profile');
    },
  },
  inLanguage: Common.inLanguage,
  subjectLanguage: Common.subjectLanguage,
  contentLocation: Common.contentLocation,

  hasPart: {
    clause:
      'SHOULD have a hasPart property referencing at least one item of type [File, PrimaryMaterial] and MAY have [File, Annotation] and [File, DerivedMaterial] items which are inter-related using annotionOf, derivedFrom properties.',
    validate: function ({ error, info, warn, results }, values, entity, crate) {
      const typesOfFile = {
        PrimaryMaterial: [],
        Annotation: [],
        DerivedMaterial: [],
      }; // Build a lookup by PrimaryMaterial, Annotation, DerivedMaterial for reporting
      if (!values) {
        info('Does not have a `hasPart` property');
        return;
      }
      for (item of values) {
        const types = new Set(item['@type']);
        for (let specialType of Object.keys(typesOfFile)) {
          // Remember this item

          if (types.has(specialType)) {
            typesOfFile[specialType].push(item);
          }
          if (!item.inLanguage) {
            item.inLanguage = entity.inLanguage;
            info(
              `inLanguage property not present on hasPart entity ${item["@id"]} - inheriting from  ${entity["@id"]}`
            );
          }
          //addInheritedProps()
          // if !item.language (item is the part, ie File) - copy language from the entity (in this case it is the RepositoryObject)
        }
        // TODO check for magic extra types and save in typesOfFile -- NOTE: not an error if PrimaryMaterial AND annotation (this is conceivable if a video has subtitles for example)
      }
      for (let specialType of Object.keys(typesOfFile)) {
        if (typesOfFile[specialType].length === 0) {
          info(LanguageDataTypes[specialType].clause);

          // TODO - call specific validations
        }
      }
      for (let t of typesOfFile.PrimaryMaterial) {
        validateEntity(PrimaryMaterial, t, crate, results);
      }
      for (let t of typesOfFile.DerivedMaterial) {
        validateEntity(DerivedMaterial, t, crate, results);
      }
      for (let t of typesOfFile.Annotation) {
        validateEntity(Annotation, t, crate, results);
      }
    },
  },
};

const Language = {
  '@id': {
    clause:
      'MUST have an @id property and the value must start with `https://collection.aiatsis.gov.au/austlang/language/` or `https://glottolog.org/resource/`',
    validate: function ({ error }, id, entity, crate) {
      if (id) {
        if (
          !(
            id.startsWith(
              'https://collection.aiatsis.gov.au/austlang/language/'
            ) || id.startsWith('https://glottolog.org/resource/')
          )
        )
          error('The value of @id not start with the right URL');
      } else {
        error('There is no @id property'); // Don't think this can ever happen, right?
      }
    },
  },
};

const PrimaryMaterial = {
  '@type': {
    clause:
      'MUST have a @type value of “PrimaryMaterial" and MAY have other @type values',
    validate: function ({ error }, values) {
      if (!values.includes('PrimaryMaterial')) {
        error('@type MUST include “PrimaryMaterial”');
      }
    },
  },
  communicationMode: RepositoryCollection.communicationMode,
  inLanguage: {
    clause:
      'MUST have a inLanguage property, or the RepositoryObject that is `partOf` MUST have a inLanguage property, referencing a Language item (language my be inhereted from the parent RepoObject)',
    validate({ error, results }, values) {
      if (!values || !values.length) {
        error('There is no language property');
        return;
      }

      // TODO: Need to get the language entity from the crate and call that
      for (const lang of values) {
        validateEntity(Language, lang, results);
      }
    },
  },
};

const DerivedMaterial = {
  '@type': {
    clause:
      'MUST have a @type value of “DerivedMaterial" and MAY have other @type values',
    validate: function ({ error }, values) {
      if (!values.includes('DerivedMaterial')) {
        error('@type MUST include “DerivedMaterial”');
      }
    },
  },
  communicationMode: RepositoryCollection.communicationMode,
  inLanguage: PrimaryMaterial.inLanguage,

  derivedFrom: {
    clause:
      'SHOULD have a derivedFrom property which references a PrimaryMaterial entity',
    validate({ error, info, warn, results }, values, entity, crate) {
      // TODO -- look for hasDerived
      if (!values || values.length === 0) {
        warn('Does not have a derivedFrom property');
        return;
      }

      for (let val of values) {
        if (!val['@id']) {
          warn(`Property value is not a reference to another entity: ${val}`);
        } else {
          referencedItem = crate.getEntity(val['@id']);
          if (!referencedItem) {
            info(
              `Property value does not resolve to another entity in this crate: ${JSON.stringify(
                val
              )}`
            );
          } else {
            // Check the type
            PrimaryMaterial['@type'].validate(
              { results, error, warn, info },
              referencedItem['@type'],
              referencedItem,
              null
            );
          }
        }
      }
    },
  },
};

const Annotation = {
  '@type': {
    clause:
      'MUST have a @type value of “Annotation" and MAY have other @type values',
    validate: function ({ error }, values) {
      if (!values.includes('Annotation')) {
        error('@type MUST include “Annotation”');
      }
    },
  },
  annotationType: {
    clause:
      'MAY have an `annotationType` property which SHOULD be a reference to one or more of the Language Data Commons Annotation Type Terms: Phonemic, Phonetic, Phonological, Syntactic, Translation, Semantic, Transcription, Prosodic',
    validate({ error, info, warn, results }, values, entity, crate) {
      if (!values || values.length === 0) {
        info('Does not have an `annotationType` property');
        return;
      }
      annotationTypes = [
        'http://purl.archive.org/language-data-commons/terms#Phonemic',
        'http://purl.archive.org/language-data-commons/terms#Phonetic',
        'http://purl.archive.org/language-data-commons/terms#Phonological',
        'http://purl.archive.org/language-data-commons/terms#Syntactic',
        'http://purl.archive.org/language-data-commons/terms#Translation',
        'http://purl.archive.org/language-data-commons/terms#Semantic',
        'http://purl.archive.org/language-data-commons/terms#Transcription',
        'http://purl.archive.org/language-data-commons/terms#Prosodic',
      ];

      info('DOES have an `annotationType` property');
      for (a of values) {
        if (!annotationTypes.includes(a['@id'])) {
          warn(`annotationType value is not expected: ${JSON.stringify(a)}`);
        }
      }
    },
  },
  conformsTo: {
    clause:
      'MAY have a `conformsTo` property which references a schema file which in turn MUST have `conformsTo` property of  {"@id": "https://specs.frictionlessdata.io/table-schema/"} ',
    validate({ error, info, warn, results }, values, entity, crate) {
      if (entity.encodingFormat.includes('text/csv') && entity.conformsTo) {
        var conforms = values.map((e) => e['@id']);
        for (let c of conforms) {
          const file = crate.getEntity(c);
          if (file && file['@type'].includes('File')) {
            var conforms = file.conformsTo.map((e) => e['@id']);
            if (
              conforms.includes('https://specs.frictionlessdata.io/table-schema/')
            ) {
              info(
                'DOES have an `conformsTo` property that indicates this is a frictionless data table schema'
              );
            }
          }
        }
      }
    },
  },

  annotationOf: {
    clause:
      'SHOULD have an `annotationOf` property which references another entity',
    validate({ error, info, warn, results }, values, entity, crate) {
      // TODO -- look for @reverse props
      if (!values || values.length === 0) {
        warn('Does not have an `annotationOf` property');
        return;
      }
      info('Does have an `annotationOf` property');
      for (let val of values) {
        if (!val['@id']) {
          warn(`Property value is not a reference to another entity: ${val}`);
        } else {
          referencedItem = crate.getEntity(val['@id']);
          if (!referencedItem) {
            info(
              `Property value does not resolve to another entity in this crate: ${JSON.stringify(
                val
              )}`
            );
          } else {
            // Check the type

            info(
              `Property value does resolve to another entity in this crate: ${JSON.stringify(
                val
              )}`
            );
          }
        }
      }
    },
  },
};

const Place = {
  '@type': {
    clause:
      'MUST have a @type value of "Place" and MAY have other @type values',
    validate: function ({ error }, values) {
      if (!values.includes('Place')) {
        error('@type MUST include "Place"');
      }
    },
  },
  geo: {
    clause:
      'MAY have a geo property, which is a reference to one or more Geometry entities',
    validate({ error, results }, values) {
      if (!values || !values.length) {
        error('There is no geo property');
        return;
      }

      for (const v of values) {
        validateEntity(rules.Geometry, v, results);
      }
    },
  },
};

const Geometry = {
  '@type': {
    clause:
      'MUST have a @type value of "Geometry" and MAY have other @type values',
    validate: function ({ error }, values) {
      if (!values.includes('Geometry')) {
        error('@type MUST include "Geometry"');
      }
    },
  },
  asWKT: {
    clause:
      'MUST have one or more asWKT property, which is text encoding the location coordinates',
    validate({ error, results }, values) {
      if (!values || !values.length) {
        error('There is no asWKT property');
        return;
      }
    },
  },
};

const rules = (module.exports = {
  Common,
  License,
  Dataset,
  RepositoryCollection,
  RepositoryObject,
  PrimaryMaterial,
  DerivedMaterial,
  Language,
  LanguageDataTypes,
  Annotation,
  Place,
  Geometry
});
