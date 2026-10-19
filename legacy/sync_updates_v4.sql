-- Sincronização dos Fiscais atualizados e remoção de duplicidade
DELETE FROM assignments WHERE id = 20;

UPDATE assignments 
SET location_name = 'Harmonia / Martinho Luterano', 
    phone = '5199129534 / 51991800882' 
WHERE id = 19;

UPDATE assignments 
SET location_name = 'Harmonia e Mathias' 
WHERE id = 8;

UPDATE assignments 
SET location_name = 'Harmonia e Rio Branco' 
WHERE id = 40;

UPDATE assignments 
SET phone = '51982246346' 
WHERE id = 15;

UPDATE assignments 
SET name = 'Marton Lampert', 
    phone = '51983024847' 
WHERE id = 17;

UPDATE assignments 
SET phone = '51993989152' 
WHERE id = 26;

UPDATE assignments 
SET name = 'Norberto Tombosi', 
    phone = '51981124517' 
WHERE id = 27;

UPDATE assignments 
SET name = 'Norberto Tombosi', 
    phone = '51981124517' 
WHERE id = 28;

UPDATE assignments 
SET phone = '51991853597' 
WHERE id = 42;

UPDATE assignments 
SET phone = '51991313725' 
WHERE id = 43;

INSERT INTO assignments (location_name, section, name, phone, created_at) 
VALUES ('EMEF GUAJUVIRAS', NULL, 'Graziele Bica', '51993861780', CURRENT_TIMESTAMP);
