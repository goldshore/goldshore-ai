[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string[]]$Addresses,

  [string]$OutputDirectory = "$env:TEMP\goldshore-mail-profiles",
  [string]$ImapHost = "gator3003.hostgator.com",
  [int]$ImapPort = 993,
  [string]$SmtpHost = "gator3003.hostgator.com",
  [int]$SmtpPort = 465
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

foreach ($address in $Addresses) {
  if ($address -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw "Invalid email address: $address"
  }

  $localPart = $address.Split('@')[0]
  $domain = $address.Split('@')[1]
  $safeName = $address.Replace('@', '-at-').Replace('.', '-')
  $profileId = [guid]::NewGuid().ToString()
  $accountId = [guid]::NewGuid().ToString()

  $mobileConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>EmailAccountDescription</key><string>$address</string>
      <key>EmailAccountName</key><string>GoldShore $localPart</string>
      <key>EmailAccountType</key><string>EmailTypeIMAP</string>
      <key>EmailAddress</key><string>$address</string>
      <key>IncomingMailServerAuthentication</key><string>EmailAuthPassword</string>
      <key>IncomingMailServerHostName</key><string>$ImapHost</string>
      <key>IncomingMailServerPortNumber</key><integer>$ImapPort</integer>
      <key>IncomingMailServerUseSSL</key><true/>
      <key>IncomingMailServerUsername</key><string>$address</string>
      <key>OutgoingMailServerAuthentication</key><string>EmailAuthPassword</string>
      <key>OutgoingMailServerHostName</key><string>$SmtpHost</string>
      <key>OutgoingMailServerPortNumber</key><integer>$SmtpPort</integer>
      <key>OutgoingMailServerUseSSL</key><true/>
      <key>OutgoingMailServerUsername</key><string>$address</string>
      <key>OutgoingPasswordSameAsIncomingPassword</key><true/>
      <key>PayloadDescription</key><string>Configures $address</string>
      <key>PayloadDisplayName</key><string>$address</string>
      <key>PayloadIdentifier</key><string>ai.goldshore.mail.$accountId</string>
      <key>PayloadType</key><string>com.apple.mail.managed</string>
      <key>PayloadUUID</key><string>$accountId</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDisplayName</key><string>GoldShore Mail - $address</string>
  <key>PayloadIdentifier</key><string>ai.goldshore.mail.$profileId</string>
  <key>PayloadOrganization</key><string>Gold Shore Labs</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>$profileId</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
"@

  $thunderbird = @"
<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="$domain">
    <domain>$domain</domain>
    <displayName>$address</displayName>
    <incomingServer type="imap">
      <hostname>$ImapHost</hostname>
      <port>$ImapPort</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>$address</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>$SmtpHost</hostname>
      <port>$SmtpPort</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>$address</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>
"@

  Set-Content -LiteralPath (Join-Path $OutputDirectory "$safeName.mobileconfig") -Value $mobileConfig -Encoding utf8
  Set-Content -LiteralPath (Join-Path $OutputDirectory "$safeName-thunderbird.xml") -Value $thunderbird -Encoding utf8
}

Write-Output $OutputDirectory
