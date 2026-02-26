const sampleJson = `{
  "display": "form",
  "components": [
    {
      "type": "textfield",
      "key": "fullName",
      "label": "Full name",
      "input": true
    },
    {
      "type": "columns",
      "key": "contact",
      "columns": [
        {
          "components": [
            {
              "type": "email",
              "key": "email",
              "label": "Email",
              "input": true
            }
          ]
        },
        {
          "components": [
            {
              "type": "phoneNumber",
              "key": "phone",
              "label": "Phone",
              "input": true
            }
          ]
        }
      ]
    }
  ]
}`;

export default sampleJson;
