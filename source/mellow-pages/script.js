// The Mellow Pages - Main JavaScript functionality
class MellowPages {
    constructor() {
        this.words = {};
        this.reverseMap = {};
        this.countryCodes = [];
        this.countryCodeMap = {};
        this.isLoaded = false;
        this.demoIntervals = {};
        this.demoStopped = false;
        this.init();
    }

    async init() {
        await this.loadWords();
        await this.loadCountryCodes();
        this.setupEventListeners();
        this.updateWordCounts();
        this.startDemoAnimations();
    }

    async loadWords() {
        try {
            const response = await fetch('memorable_words_string_indexed_full.json');
            this.words = await response.json();
            
            // Create reverse mapping for word-to-number conversion
            this.reverseMap = Object.fromEntries(
                Object.entries(this.words).map(([k, v]) => [v.toLowerCase(), parseInt(k)])
            );
            
            this.isLoaded = true;
            console.log(`Loaded ${Object.keys(this.words).length} words`);
        } catch (error) {
            console.error('Failed to load words:', error);
            this.showError('Failed to load word database. Please refresh the page.');
        }
    }

    async loadCountryCodes() {
        try {
            const response = await fetch('country_codes.json');
            this.countryCodes = await response.json();
            
            // Create mapping from dial codes to country names (cleaned)
            this.countryCodeMap = {};
            this.countryCodes.forEach((country, index) => {
                const cleanCode = country.dial_code.replace('+', '');
                const cleanName = country.name.toLowerCase().replace(/[^a-z]/g, '');
                this.countryCodeMap[cleanCode] = {
                    name: cleanName,
                    fullName: country.name,
                    index: index
                };
            });
            
            console.log(`Loaded ${this.countryCodes.length} country codes`);
        } catch (error) {
            console.error('Failed to load country codes:', error);
            // Set some default fallbacks
            this.countryCodes = [
                { name: "United States", dial_code: "+1", code: "US" },
                { name: "United Kingdom", dial_code: "+44", code: "GB" }
            ];
        }
    }

    setupEventListeners() {
        // Words to Number form (index.html)
        const wordsForm = document.getElementById('wordsForm');
        if (wordsForm) {
            wordsForm.addEventListener('submit', (e) => this.handleWordsSubmit(e));
            
            // Setup autocomplete for word inputs
            ['word1', 'word2', 'word3'].forEach((id, index) => {
                const input = document.getElementById(id);
                if (input) {
                    this.setupAutocomplete(input, `suggestions${index + 1}`);
                }
            });
            
            // Setup country word autocomplete
            const countryInput = document.getElementById('countryWord');
            if (countryInput) {
                this.setupCountryAutocomplete(countryInput, 'countrySuggestions');
            }
            
            // Handle country checkbox
            const countryCheckbox = document.getElementById('showCountryWord');
            const countryContainer = document.getElementById('countryWordContainer');
            if (countryCheckbox && countryContainer) {
                countryCheckbox.addEventListener('change', () => {
                    if (countryCheckbox.checked) {
                        countryContainer.classList.remove('d-none');
                    } else {
                        countryContainer.classList.add('d-none');
                        if (countryInput) countryInput.value = '';
                    }
                });
            }
        }

        // Number to Words form (number-to-words.html)
        const phoneForm = document.getElementById('phoneForm');
        if (phoneForm) {
            phoneForm.addEventListener('submit', (e) => this.handlePhoneSubmit(e));
            
            // Handle country code checkbox and section visibility
            const countryCheckbox = document.getElementById('showCountryCode');
            const countrySection = document.getElementById('countryCodeSection');
            const countryCodeInput = document.getElementById('countryCode');
            
            if (countryCheckbox && countrySection && countryCodeInput) {
                // Set up auto-formatting for country code input
                countryCodeInput.addEventListener('input', (e) => this.formatCountryCode(e));
                
                countryCheckbox.addEventListener('change', () => {
                    if (countryCheckbox.checked) {
                        countrySection.style.display = 'block';
                        // Clear the input when first shown, don't default to +1
                        countryCodeInput.value = '';
                    } else {
                        countrySection.style.display = 'none';
                        // Reset to +1 when hidden (for internal logic that might depend on it)
                        countryCodeInput.value = '+1';
                    }
                });
            }
            
            // Format phone number as user types and clear placeholder on click
            const phoneInput = document.getElementById('phoneNumber');
            if (phoneInput) {
                let hasBeenClicked = false;
                let originalPlaceholder = phoneInput.placeholder;
                
                phoneInput.addEventListener('input', (e) => this.formatLocalPhoneNumber(e));
                
                // Clear placeholder and demo content on first interaction
                const clearPlaceholderAndDemo = (e) => {
                    this.stopDemo(phoneInput);
                    
                    if (!hasBeenClicked) {
                        hasBeenClicked = true;
                        // Clear placeholder text
                        e.target.placeholder = '';
                        // Clear any existing demo content
                        e.target.value = '';
                        // Remove demo animation class if present
                        e.target.classList.remove('demo-animation');
                    }
                };
                
                phoneInput.addEventListener('focus', clearPlaceholderAndDemo);
                phoneInput.addEventListener('click', clearPlaceholderAndDemo);
                phoneInput.addEventListener('mousedown', clearPlaceholderAndDemo);
                phoneInput.addEventListener('blur', () => {
                    // Only restart demo if user hasn't interacted and field is empty
                    if (!hasBeenClicked && !phoneInput.value) {
                        phoneInput.placeholder = originalPlaceholder;
                        this.restartDemo(phoneInput);
                    }
                });
            }
        }

        // Copy functionality
        const copyButton = document.getElementById('copyWords');
        if (copyButton) {
            copyButton.addEventListener('click', () => this.copyWords());
        }
    }

    setupAutocomplete(input, suggestionsId) {
        const suggestionsElement = document.getElementById(suggestionsId);
        let currentFocus = -1;

        input.addEventListener('input', (e) => {
            if (!this.isLoaded) return;
            
            const value = e.target.value.toLowerCase().trim();
            this.clearSuggestions(suggestionsElement);
            
            if (value.length < 2) return;

            const matches = Object.values(this.words)
                .filter(word => word.toLowerCase().startsWith(value))
                .slice(0, 10); // Limit to 10 suggestions

            if (matches.length > 0) {
                this.showSuggestions(matches, value, suggestionsElement, input);
            }
        });

        input.addEventListener('focus', () => {
            this.stopDemo(input);
        });
        
        input.addEventListener('blur', () => {
            this.restartDemo(input);
        });

        input.addEventListener('keydown', (e) => {
            const items = suggestionsElement.querySelectorAll('.dropdown-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentFocus = (currentFocus + 1) % items.length;
                this.setActiveSuggestion(items, currentFocus);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentFocus = currentFocus <= 0 ? items.length - 1 : currentFocus - 1;
                this.setActiveSuggestion(items, currentFocus);
            } else if (e.key === 'Enter' && currentFocus >= 0) {
                e.preventDefault();
                items[currentFocus].click();
            } else if (e.key === 'Escape') {
                this.clearSuggestions(suggestionsElement);
                currentFocus = -1;
            }
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsElement.contains(e.target)) {
                this.clearSuggestions(suggestionsElement);
                currentFocus = -1;
            }
        });
    }

    showSuggestions(matches, query, element, input) {
        element.innerHTML = '';
        element.classList.add('show');
        
        matches.forEach(word => {
            const item = document.createElement('a');
            item.className = 'dropdown-item';
            item.href = '#';
            
            // Highlight matching part
            const regex = new RegExp(`(${query})`, 'gi');
            item.innerHTML = word.replace(regex, '<span class="highlight">$1</span>');
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                input.value = word;
                this.clearSuggestions(element);
                input.focus();
            });
            
            element.appendChild(item);
        });
    }

    setActiveSuggestion(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

    clearSuggestions(element) {
        element.innerHTML = '';
        element.classList.remove('show');
    }

    handlePhoneSubmit(e) {
        e.preventDefault();
        
        // Check if phone input has demo animation class - if so, don't submit
        const phoneInputElement = document.getElementById('phoneNumber');
        const countryWordElement = document.getElementById('countryWord');
        if ((phoneInputElement && phoneInputElement.classList.contains('demo-animation')) ||
            (countryWordElement && countryWordElement.classList.contains('demo-animation'))) {
            // Demo is running, don't submit
            return;
        }
        
        // Stop demo permanently when user submits (no input element so won't show forms)
        this.stopDemo();
        
        if (!this.isLoaded) {
            this.showError('Word database is still loading. Please wait...');
            return;
        }

        const phoneInput = document.getElementById('phoneNumber').value;
        const countryCodeInput = document.getElementById('countryCode');
        const showCountryCode = document.getElementById('showCountryCode');
        
        // Get country code if international number is selected
        let countryCode = '';
        let hasCountryCode = false;
        if (showCountryCode && showCountryCode.checked && countryCodeInput) {
            const countryCodeValue = countryCodeInput.value.trim();
            if (countryCodeValue) {
                // Remove + and extract just the digits
                countryCode = countryCodeValue.replace(/^\+/, '').replace(/[^\d]/g, '');
                hasCountryCode = countryCode.length > 0;
            }
        }
        
        // Clean the phone input (remove all non-digits)
        const cleanPhone = phoneInput.replace(/[^\d]/g, '');

        if (cleanPhone.length < 7 || cleanPhone.length > 15) {
            this.showError('Please enter a valid phone number (7-15 digits).');
            return;
        }

        // Validate country code if international is selected
        if (showCountryCode && showCountryCode.checked && !hasCountryCode) {
            this.showError('Please enter a country code for international numbers.');
            return;
        }

        try {
            // Pass cleanPhone (local number) and country code separately
            const words = this.phoneToWords(cleanPhone, hasCountryCode, countryCode);
            
            // Pass the local number and country code separately to avoid concatenation issues
            this.showPhoneResult(cleanPhone, words, hasCountryCode, countryCode);
        } catch (error) {
            this.showError(error.message);
        }
    }

    phoneToWords(phoneNumber, hasInternationalPrefix = false, explicitCountryCode = '') {
        // Use explicit country code if provided, otherwise extract from phone number
        let countryCode = explicitCountryCode;
        let localNumber = phoneNumber;
        
        if (explicitCountryCode) {
            // Country code provided separately, use phoneNumber as local number only
            localNumber = phoneNumber;
            countryCode = explicitCountryCode;
        } else if (hasInternationalPrefix && phoneNumber.length > 10) {
            // Extract country code (1-4 digits from start) 
            const possibleCountryCode = phoneNumber.substring(0, phoneNumber.length - 10);
            if (possibleCountryCode.length <= 4) {
                countryCode = possibleCountryCode;
                localNumber = phoneNumber.substring(possibleCountryCode.length);
            }
        } else if (!hasInternationalPrefix && phoneNumber.length === 10) {
            // American number - no country code extraction
            localNumber = phoneNumber;
        }
        
        // Handle local number by dividing into 3 segments
        const numLength = localNumber.length;
        let part1, part2, part3;
        
        if (numLength <= 9) {
            // Short numbers: divide into 3 roughly equal parts
            const segmentLength = Math.ceil(numLength / 3);
            part1 = localNumber.substring(0, segmentLength);
            part2 = localNumber.substring(segmentLength, segmentLength * 2);
            part3 = localNumber.substring(segmentLength * 2);
        } else {
            // Longer numbers: first 3, middle section, last 3
            const middleStart = 3;
            const middleEnd = numLength - 3;
            part1 = localNumber.substring(0, middleStart);
            part2 = localNumber.substring(middleStart, middleEnd);
            part3 = localNumber.substring(middleEnd);
        }

        // Use the string-indexed word database directly
        const word1 = this.words[part1] || this.words[part1.padStart(4, '0')] || 'unknown';
        const word2 = this.words[part2] || this.words[part2.padStart(4, '0')] || 'unknown';
        const word3 = this.words[part3] || this.words[part3.padStart(4, '0')] || 'unknown';

        // Map country code to country name if present
        let countryWord = '';
        let countryInfo = null;
        if (countryCode && this.countryCodes.length > 0) {
            // Find country by dial code, not by index
            countryInfo = this.countryCodes.find(country => 
                country.dial_code.replace('+', '') === countryCode
            );
            if (countryInfo) {
                countryWord = countryInfo.name.toLowerCase().replace(/[^a-z]/g, '');
            }
        }

        return [
            word1,
            word2,
            word3,
            [parseInt(part1) || 0, parseInt(part2) || 0, parseInt(part3) || 0], // Return original numbers for display
            countryWord,
            countryCode,
            hasInternationalPrefix,
            countryInfo
        ];
    }

    wordsToPhone(word1, word2, word3, countryWord = '') {
        // Create reverse mapping for the string-indexed words
        const reverseMap = Object.fromEntries(
            Object.entries(this.words).map(([k, v]) => [v.toLowerCase(), k])
        );

        // Find string keys for each word
        const key1 = reverseMap[word1];
        const key2 = reverseMap[word2];
        const key3 = reverseMap[word3];

        if (key1 === undefined) throw new Error(`Word "${word1}" not found in database.`);
        if (key2 === undefined) throw new Error(`Word "${word2}" not found in database.`);
        if (key3 === undefined) throw new Error(`Word "${word3}" not found in database.`);

        // Find country code from word if specified
        let countryCode = '';
        let countryInfo = null;
        if (countryWord) {
            // Look for country by name in country codes database
            countryInfo = this.countryCodes.find(c => 
                c.name.toLowerCase().replace(/[^a-z]/g, '') === countryWord.toLowerCase().replace(/[^a-z]/g, '')
            );
            if (!countryInfo) {
                throw new Error(`Country "${countryWord}" not found in database.`);
            }
            countryCode = countryInfo.dial_code.replace('+', '');
        }

        // Reconstruct phone number from the string keys (local number only)
        const localNumber = key1 + key2 + key3;

        // Return both local number and country info for proper formatting
        return {
            localNumber: localNumber,
            countryCode: countryCode,
            countryInfo: countryInfo,
            hasCountryCode: !!countryCode
        };
    }

    setupCountryAutocomplete(input, suggestionsId) {
        const suggestionsElement = document.getElementById(suggestionsId);
        let currentFocus = -1;

        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            this.clearSuggestions(suggestionsElement);
            
            if (value.length < 2) return;

            const matches = this.countryCodes
                .filter(country => country.name.toLowerCase().includes(value))
                .slice(0, 10); // Limit to 10 suggestions

            if (matches.length > 0) {
                this.showCountrySuggestions(matches, value, suggestionsElement, input);
            }
        });

        input.addEventListener('focus', () => {
            this.stopDemo(input);
        });
        
        input.addEventListener('blur', () => {
            this.restartDemo(input);
        });

        input.addEventListener('keydown', (e) => {
            const items = suggestionsElement.querySelectorAll('.dropdown-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentFocus = (currentFocus + 1) % items.length;
                this.setActiveSuggestion(items, currentFocus);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentFocus = currentFocus <= 0 ? items.length - 1 : currentFocus - 1;
                this.setActiveSuggestion(items, currentFocus);
            } else if (e.key === 'Enter' && currentFocus >= 0) {
                e.preventDefault();
                items[currentFocus].click();
            } else if (e.key === 'Escape') {
                this.clearSuggestions(suggestionsElement);
                currentFocus = -1;
            }
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsElement.contains(e.target)) {
                this.clearSuggestions(suggestionsElement);
                currentFocus = -1;
            }
        });
    }

    showCountrySuggestions(matches, query, element, input) {
        element.innerHTML = '';
        element.classList.add('show');
        
        matches.forEach(country => {
            const item = document.createElement('a');
            item.className = 'dropdown-item';
            item.href = '#';
            
            // Show country name with dial code
            const displayText = `${country.name} (${country.dial_code})`;
            const regex = new RegExp(`(${query})`, 'gi');
            item.innerHTML = displayText.replace(regex, '<span class="highlight">$1</span>');
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                input.value = country.name.toLowerCase().replace(/[^a-z]/g, '');
                this.clearSuggestions(element);
                input.focus();
            });
            
            element.appendChild(item);
        });
    }

    handleWordsSubmit(e) {
        e.preventDefault();
        
        // Check if inputs have demo animation class - if so, don't submit
        const word1Input = document.getElementById('word1');
        const word2Input = document.getElementById('word2');
        const word3Input = document.getElementById('word3');
        
        if (word1Input && word1Input.classList.contains('demo-animation') ||
            word2Input && word2Input.classList.contains('demo-animation') ||
            word3Input && word3Input.classList.contains('demo-animation')) {
            // Demo is running, don't submit
            return;
        }
        
        // Stop demo permanently when user submits (no input element so won't show forms)
        this.stopDemo();
        
        if (!this.isLoaded) {
            this.showError('Word database is still loading. Please wait...');
            return;
        }

        const word1 = document.getElementById('word1').value.toLowerCase().trim();
        const word2 = document.getElementById('word2').value.toLowerCase().trim();
        const word3 = document.getElementById('word3').value.toLowerCase().trim();
        const countryWord = document.getElementById('countryWord') ? 
                           document.getElementById('countryWord').value.toLowerCase().trim() : '';

        if (!word1 || !word2 || !word3) {
            this.showError('Please enter the first three words.');
            return;
        }

        try {
            const phoneResult = this.wordsToPhone(word1, word2, word3, countryWord);
            this.showWordsResult(phoneResult, [word1, word2, word3], countryWord);
        } catch (error) {
            this.showError(error.message);
        }
    }

    formatPhoneNumber(e) {
        let value = e.target.value;
        
        // Handle + prefix for international numbers
        const hasPlus = value.startsWith('+');
        const cleanValue = value.replace(/[^\d+]/g, '');
        const digits = cleanValue.replace('+', '');
        
        if (hasPlus) {
            // International format with +
            if (digits.length >= 11) {
                // 11+ digits: +XXX-XXX-XXXX-X+ format
                value = `+${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6, 10)}-${digits.substring(10)}`;
            } else if (digits.length >= 10) {
                // 10 digits: +XXX-XXX-XXXX format
                value = `+${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
            } else if (digits.length >= 8) {
                // 8-9 digits: +XXX-XXX-XX+ format
                value = `+${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}`;
            } else if (digits.length >= 6) {
                // 6-7 digits: +XXX-XXX+ format
                value = `+${digits.substring(0, 3)}-${digits.substring(3)}`;
            } else if (digits.length >= 3) {
                // 3-5 digits: +XXX-X+ format
                value = `+${digits.substring(0, 3)}-${digits.substring(3)}`;
            } else if (digits.length > 0) {
                value = `+${digits}`;
            } else {
                value = '+';
            }
        } else {
            // US format without + (assume American)
            if (digits.length >= 10) {
                // 10+ digits: (XXX) XXX-XXXX format (American style)
                value = `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
                if (digits.length > 10) {
                    value += ` ext. ${digits.substring(10)}`;
                }
            } else if (digits.length >= 7) {
                // 7-9 digits: XXX-XXXX+ format
                value = `${digits.substring(0, 3)}-${digits.substring(3)}`;
            } else if (digits.length >= 3) {
                // 3-6 digits: XXX-X+ format
                value = `${digits.substring(0, 3)}-${digits.substring(3)}`;
            } else {
                value = digits;
            }
        }
        
        e.target.value = value;
    }

    formatLocalPhoneNumber(e) {
        let value = e.target.value;
        
        // Check if country code section is visible - if so, don't allow + signs in phone field
        const countryCodeSection = document.getElementById('countryCodeSection');
        const isCountryCodeVisible = countryCodeSection && countryCodeSection.style.display !== 'none';
        
        if (isCountryCodeVisible) {
            // Remove + signs and other international formatting from phone field
            value = value.replace(/[^\d\-]/g, '');
        }
        
        // Remove non-digits for formatting
        const digits = value.replace(/[^\d]/g, '');
        
        // Format based on length
        if (digits.length >= 10) {
            // 10+ digits: XXX-XXX-XXXX format
            value = `${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
            if (digits.length > 10) {
                value += `-${digits.substring(10)}`;
            }
        } else if (digits.length >= 7) {
            // 7-9 digits: XXX-XXXX+ format
            value = `${digits.substring(0, 3)}-${digits.substring(3)}`;
        } else if (digits.length >= 3) {
            // 3-6 digits: XXX-X+ format
            value = `${digits.substring(0, 3)}-${digits.substring(3)}`;
        } else {
            value = digits;
        }
        
        e.target.value = value;
    }

    formatLocalNumber(phoneNumber) {
        // Format local phone numbers (without country code)
        const length = phoneNumber.length;
        
        if (length >= 10) {
            // 10+ digits: XXX-XXX-XXXX+ format
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6, 10)}${phoneNumber.length > 10 ? '-' + phoneNumber.substring(10) : ''}`;
        } else if (length >= 7) {
            // 7-9 digits: XXX-XXXX+ format
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3)}`;
        } else if (length >= 4) {
            // 4-6 digits: XXX-X+ format  
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3)}`;
        } else {
            return phoneNumber;
        }
    }

    showPhoneResult(localPhoneNumber, wordsData, hasInternationalPrefix = false, separateCountryCode = '') {
        const [word1, word2, word3, numbers, countryWord, countryCode, isInternational, countryInfo] = wordsData;
        
        // Format phone number appropriately
        let formattedPhone;
        if (hasInternationalPrefix && separateCountryCode) {
            // Format with separate country code: +CC local-number
            const formattedLocal = this.formatLocalNumber(localPhoneNumber);
            formattedPhone = `+${separateCountryCode} ${formattedLocal}`;
        } else if (hasInternationalPrefix) {
            formattedPhone = '+' + this.formatInternationalNumber(localPhoneNumber);
        } else {
            // American format: (XXX) XXX-XXXX
            if (localPhoneNumber.length === 10) {
                formattedPhone = `(${localPhoneNumber.substring(0, 3)}) ${localPhoneNumber.substring(3, 6)}-${localPhoneNumber.substring(6)}`;
            } else {
                formattedPhone = this.formatInternationalNumber(localPhoneNumber);
            }
        }
        
        // Update phone number display
        const phoneDisplayElement = document.getElementById('phoneNumberDisplay');
        if (phoneDisplayElement) {
            phoneDisplayElement.textContent = formattedPhone;
        }
        
        // Update summary - include country word if international
        const summary = (countryWord && hasInternationalPrefix) ? 
                       `${countryWord} ${word1} ${word2} ${word3}` : 
                       `${word1} ${word2} ${word3}`;
        document.getElementById('wordsSummary').textContent = summary;
        
        this.hideError();
        document.getElementById('result').classList.remove('d-none');
        
        // Hide the form sections and show reset button
        this.hideFormSections();
    }

    showWordsResult(phoneResult, words, countryWord = '') {
        // Format phone number appropriately
        let formattedPhone;
        if (phoneResult.hasCountryCode) {
            // Format with separate country code: +CC local-number
            const formattedLocal = this.formatLocalNumber(phoneResult.localNumber);
            formattedPhone = `+${phoneResult.countryCode} ${formattedLocal}`;
        } else {
            // US format: (XXX) XXX-XXXX
            if (phoneResult.localNumber.length === 10) {
                formattedPhone = `(${phoneResult.localNumber.substring(0, 3)}) ${phoneResult.localNumber.substring(3, 6)}-${phoneResult.localNumber.substring(6)}`;
            } else {
                formattedPhone = this.formatInternationalNumber(phoneResult.localNumber);
            }
        }
        
        document.getElementById('phoneNumber').textContent = formattedPhone;
        
        this.hideError();
        document.getElementById('result').classList.remove('d-none');
        
        // Hide the form sections and show reset button
        this.hideFormSections();
    }

    showDemoResult(phoneNumber, words, countryWord = '') {
        // Show demo result without hiding the form (for animations only)
        document.getElementById('phoneNumber').textContent = phoneNumber;
        
        this.hideError();
        document.getElementById('result').classList.remove('d-none');
        
        // DO NOT hide form sections for demo - keep them visible
    }

    showDemoPhoneResult(localPhoneNumber, wordsData, hasInternationalPrefix = false, separateCountryCode = '') {
        // Show demo result without hiding the form (for animations only)
        const [word1, word2, word3, numbers, countryWord, countryCode, isInternational, countryInfo] = wordsData;
        
        // Format phone number appropriately
        let formattedPhone;
        if (hasInternationalPrefix && separateCountryCode) {
            // Format with separate country code: +CC local-number
            const formattedLocal = this.formatLocalNumber(localPhoneNumber);
            formattedPhone = `+${separateCountryCode} ${formattedLocal}`;
        } else if (hasInternationalPrefix) {
            formattedPhone = '+' + this.formatInternationalNumber(localPhoneNumber);
        } else {
            // American format: (XXX) XXX-XXXX
            if (localPhoneNumber.length === 10) {
                formattedPhone = `(${localPhoneNumber.substring(0, 3)}) ${localPhoneNumber.substring(3, 6)}-${localPhoneNumber.substring(6)}`;
            } else {
                formattedPhone = this.formatInternationalNumber(localPhoneNumber);
            }
        }
        
        // Update phone number display
        const phoneDisplayElement = document.getElementById('phoneNumberDisplay');
        if (phoneDisplayElement) {
            phoneDisplayElement.textContent = formattedPhone;
        }
        
        // Update summary
        const summary = (countryWord && hasInternationalPrefix) ? 
                       `${countryWord} ${word1} ${word2} ${word3}` : 
                       `${word1} ${word2} ${word3}`;
        document.getElementById('wordsSummary').textContent = summary;
        
        this.hideError();
        document.getElementById('result').classList.remove('d-none');
        
        // DO NOT hide form sections for demo - keep them visible
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('error').classList.remove('d-none');
        
        const result = document.getElementById('result');
        if (result) result.classList.add('d-none');
    }

    hideError() {
        const error = document.getElementById('error');
        if (error) error.classList.add('d-none');
    }

    copyWords() {
        const words = document.getElementById('wordsSummary').textContent;
        navigator.clipboard.writeText(words).then(() => {
            const button = document.getElementById('copyWords');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
            button.classList.replace('btn-outline-primary', 'btn-success');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.replace('btn-success', 'btn-outline-primary');
            }, 2000);
        });
    }

    updateWordCounts() {
        // Update word counts on about page
        const wordCountElement = document.getElementById('wordCount');
        const totalWordsElement = document.getElementById('totalWords');
        
        if (this.isLoaded && wordCountElement) {
            const count = Object.keys(this.words).length;
            wordCountElement.textContent = count.toLocaleString();
        }
        
        if (this.isLoaded && totalWordsElement) {
            const count = Object.keys(this.words).length;
            totalWordsElement.textContent = count.toLocaleString();
        }
    }

    startDemoAnimations() {
        // Start demo for words to number page (index.html)
        const word1Input = document.getElementById('word1');
        const word2Input = document.getElementById('word2');
        const word3Input = document.getElementById('word3');
        
        if (word1Input && word2Input && word3Input && this.isLoaded) {
            this.startWordsDemo([word1Input, word2Input, word3Input]);
        }
        
        // Start demo for number to words page
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput && this.isLoaded) {
            this.startPhoneDemo(phoneInput);
        }
    }
    
    startWordsDemo(inputs) {
        if (!this.isLoaded) return;
        
        const demoWords = [
            ['apple', 'house', 'music', 'bright'],
            ['ocean', 'forest', 'stone', 'simple'],
            ['cloud', 'quick', 'dream', 'gentle'],
            ['river', 'flame', 'dawn', 'smooth'],
            ['storm', 'light', 'peace', 'strong']
        ];
        
        // Find country input if it exists and is visible
        const countryInput = document.getElementById('countryWord');
        const countryContainer = document.getElementById('countryWordContainer');
        const showCountryCheckbox = document.getElementById('showCountryWord');
        const shouldIncludeCountry = countryInput && countryContainer && 
                                   !countryContainer.classList.contains('d-none') &&
                                   showCountryCheckbox && showCountryCheckbox.checked;
        
        const allInputs = shouldIncludeCountry ? [...inputs, countryInput] : inputs;
        const maxInputIndex = shouldIncludeCountry ? 3 : 2;
        
        let currentSet = 0;
        let charIndex = 0;
        let inputIndex = 0;
        let isDeleting = false;
        let showingResult = false;
        let resultTimeout = null;
        
        const typeDemo = () => {
            if (this.demoStopped || this.isInputFocused(allInputs)) {
                return;
            }
            
            // If showing result, wait before starting next cycle
            if (showingResult) {
                return;
            }
            
            const currentWords = demoWords[currentSet];
            const currentWord = currentWords[inputIndex];
            const currentInput = allInputs[inputIndex];
            
            if (!isDeleting) {
                // Typing
                currentInput.value = currentWord.substring(0, charIndex);
                currentInput.classList.add('demo-animation');
                charIndex++;
                
                if (charIndex > currentWord.length) {
                    if (inputIndex < maxInputIndex) {
                        // Move to next input
                        inputIndex++;
                        charIndex = 0;
                    } else {
                        // All words typed, show conversion
                        this.performDemoConversion(currentWords.slice(0, maxInputIndex + 1));
                        showingResult = true;
                        
                        // Start deleting after showing result
                        resultTimeout = setTimeout(() => {
                            showingResult = false;
                            isDeleting = true;
                            this.clearDemoResult();
                        }, 3000);
                    }
                }
            } else {
                // Deleting
                if (inputIndex >= 0) {
                    const currentWord = currentWords[inputIndex];
                    currentInput.value = currentWord.substring(0, charIndex);
                    charIndex--;
                    
                    if (charIndex < 0) {
                        if (inputIndex > 0) {
                            inputIndex--;
                            charIndex = currentWords[inputIndex].length;
                        } else {
                            // Start next set
                            currentSet = (currentSet + 1) % demoWords.length;
                            inputIndex = 0;
                            charIndex = 0;
                            isDeleting = false;
                            
                            // Clear all inputs
                            allInputs.forEach(input => {
                                input.value = '';
                                input.classList.add('demo-animation');
                            });
                        }
                    }
                }
            }
        };
        
        this.demoIntervals.words = setInterval(typeDemo, 150);
    }
    
    performDemoConversion(words) {
        try {
            const countryWord = words.length > 3 ? words[3] : '';
            const phoneResult = this.wordsToPhone(words[0], words[1], words[2], countryWord);
            
            // Show demo result without hiding the form
            //this.showDemoResult(phoneResult, words.slice(0, 3), countryWord);
        } catch (error) {
            // Silently ignore demo conversion errors
        }
    }
    
    clearDemoResult() {
        const result = document.getElementById('result');
        const error = document.getElementById('error');
        if (result) result.classList.add('d-none');
        if (error) error.classList.add('d-none');
        
        // Ensure forms stay visible during demo (don't call showFormSections which clears inputs)
        const phoneForm = document.getElementById('phoneForm');
        const wordsForm = document.getElementById('wordsForm');
        
        if (phoneForm) {
            phoneForm.style.display = 'block';
        }
        if (wordsForm) {
            wordsForm.style.display = 'block';
        }
        
        // Hide the "Enter Another" button during demos
        this.hideEnterAnotherButton();
    }
    
    startPhoneDemo(phoneInput) {
        if (!this.isLoaded) return;
        
        const demoNumbers = [
            '555-123-4567',      // US format (10 digits)
            '212-555-0123',      // US format (NYC)
            '20-7946-0958',      // UK format (11 digits)
            '1-42-86-83-00',     // France format (10 digits)
            '30-12345678',       // Germany format (11 digits)
            '3-1234-5678',       // Japan format (11 digits)
            '2-9876-5432'        // Australia format
        ];
        
        let currentNumber = 0;
        let charIndex = 0;
        let isDeleting = false;
        
        const typeDemo = () => {
            if (this.demoStopped || phoneInput.matches(':focus')) {
                return;
            }
            
            const number = demoNumbers[currentNumber];
            
            if (!isDeleting) {
                // Typing
                phoneInput.value = number.substring(0, charIndex);
                phoneInput.classList.add('demo-animation');
                charIndex++;
                
                if (charIndex > number.length) {
                    // Start deleting after a pause (no conversion)
                    setTimeout(() => {
                        isDeleting = true;
                    }, 2500);
                }
            } else {
                // Deleting
                phoneInput.value = number.substring(0, charIndex);
                charIndex--;
                
                if (charIndex < 0) {
                    // Start next number
                    currentNumber = (currentNumber + 1) % demoNumbers.length;
                    charIndex = 0;
                    isDeleting = false;
                    phoneInput.value = '';
                    phoneInput.classList.add('demo-animation');
                }
            }
        };
        
        this.demoIntervals.phone = setInterval(typeDemo, 200);
    }
    
    isInputFocused(inputs) {
        return inputs.some(input => input.matches(':focus'));
    }
    
    stopDemo(inputElement) {
        // Stop all demos permanently
        this.demoStopped = true;
        Object.values(this.demoIntervals).forEach(interval => clearInterval(interval));
        this.demoIntervals = {};
        
        // Only clear demo content from inputs that have demo-animation class
        const demoInputs = document.querySelectorAll('input.demo-animation');
        demoInputs.forEach(input => {
            input.value = '';
            input.classList.remove('demo-animation');
        });
        
        // Clear any demo results only if this was triggered by user interaction, not form submission
        if (inputElement) {
            this.clearDemoResult();
            inputElement.focus();
        }
    }
    
    restartDemo(inputElement) {
        // Don't restart demo once stopped
        return;
    }

    formatInternationalNumber(phoneNumber) {
        // Format international numbers with dashes based on length
        const length = phoneNumber.length;
        
        if (length >= 11) {
            // 11+ digits: XXX-XXX-XXXX-X+ format
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6, 10)}-${phoneNumber.substring(10)}`;
        } else if (length >= 10) {
            // 10 digits: XXX-XXX-XXXX format
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6, 10)}`;
        } else if (length >= 8) {
            // 8-9 digits: XXX-XXX-XX+ format
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
        } else if (length >= 6) {
            // 6-7 digits: XXX-XXX+ format
            return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3)}`;
        } else {
            // 5 or fewer digits: XXX-XX format
            return phoneNumber.length >= 3 ? `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3)}` : phoneNumber;
        }
    }
    
    isDemoContent(value) {
        const demoNumbers = [
            '(555) 123-4567',
            '(212) 555-0123',
            '+44-20-7946-0958',
            '+33-1-42-86-83-00',
            '+49-30-12345678',
            '+81-3-1234-5678',
            '+1-555-123-4567'
        ];
        
        // Check if the value matches any demo number (partially or fully)
        return demoNumbers.some(demo => demo.startsWith(value) && value.length > 3);
    }

    stringToIndex(str, maxIndex) {
        // Create a hash from the string that preserves both value and format
        let hash = 0;
        
        // Include string length in hash to differentiate "04" from "4"
        hash = str.length * 1000;
        
        // Add character values
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Ensure positive index within range
        return Math.abs(hash) % (maxIndex + 1);
    }

    hideFormSections() {
        // Hide form sections on both pages
        const phoneForm = document.getElementById('phoneForm');
        const wordsForm = document.getElementById('wordsForm');
        
        if (phoneForm) {
            phoneForm.style.display = 'none';
        }
        if (wordsForm) {
            wordsForm.style.display = 'none';
        }
        
        // Show the "Enter another" button
        this.showEnterAnotherButton();
    }

    showFormSections() {
        // Show form sections on both pages
        const phoneForm = document.getElementById('phoneForm');
        const wordsForm = document.getElementById('wordsForm');
        
        if (phoneForm) {
            phoneForm.style.display = 'block';
        }
        if (wordsForm) {
            wordsForm.style.display = 'block';
        }
        
        // Hide the result and reset button
        document.getElementById('result').classList.add('d-none');
        this.hideEnterAnotherButton();
        
        // Clear any existing values
        this.clearForms();
    }

    showEnterAnotherButton() {
        let button = document.getElementById('enterAnotherBtn');
        if (!button) {
            // Create the button if it doesn't exist
            button = document.createElement('button');
            button.id = 'enterAnotherBtn';
            button.className = 'btn btn-outline-primary btn-sm mt-3';
            button.textContent = 'Enter Another';
            button.addEventListener('click', () => this.showFormSections());
            
            // Insert after the result div
            const result = document.getElementById('result');
            result.parentNode.insertBefore(button, result.nextSibling);
        }
        button.style.display = 'block';
    }

    hideEnterAnotherButton() {
        const button = document.getElementById('enterAnotherBtn');
        if (button) {
            button.style.display = 'none';
        }
    }

    clearForms() {
        // Clear phone form
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.value = '';
        }
        
        // Clear words form
        const word1 = document.getElementById('word1');
        const word2 = document.getElementById('word2');
        const word3 = document.getElementById('word3');
        const countryWord = document.getElementById('countryWord');
        
        if (word1) word1.value = '';
        if (word2) word2.value = '';
        if (word3) word3.value = '';
        if (countryWord) countryWord.value = '';
        
        // Hide country section if it was shown (applies to both pages)
        const countryContainer = document.getElementById('countryWordContainer');
        const countryCheckbox = document.getElementById('showCountryWord');
        if (countryContainer && countryCheckbox) {
            countryContainer.classList.add('d-none');
            countryCheckbox.checked = false;
        }
    }

    formatCountryCode(e) {
        let value = e.target.value;
        
        // Remove all non-digits first
        const digits = value.replace(/[^\d]/g, '');
        
        // If there are digits, add + prefix, otherwise keep empty
        if (digits.length > 0) {
            value = `+${digits}`;
        } else {
            value = '';
        }
        
        e.target.value = value;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mellowPages = new MellowPages();
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MellowPages;
}
